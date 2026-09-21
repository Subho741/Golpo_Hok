import { Conversation, Message, User } from "../models/index.js";
import { AppError } from "../middleware/errors.js";
import { id, messageInput } from "../middleware/validation.js";
export const userRoom = (id) => `user:${id}`;
export function createChatService(io, online) {
  const presentUser = (user) => ({
    _id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    status: user.status,
    lastSeen: user.lastSeen,
    online: online.has(String(user._id)),
  });
  const populateMessage = (q) => q.populate("replyTo", "text sender deletedAt");
  async function member(conversationId, userId) {
    id.parse(conversationId);
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) throw new AppError(404, "Conversation not found.");
    return conversation;
  }
  function emit(conversation, event, data) {
    io.to(conversation.participants.map(userRoom)).emit(event, data);
  }
  async function send(userId, input) {
    const data = messageInput.parse(input);
    const conversation = await member(data.conversationId, userId);
    const previous = await populateMessage(
      Message.findOne({ sender: userId, clientId: data.clientId }),
    );
    if (previous) {
      if (String(previous.conversationId) !== data.conversationId)
        throw new AppError(409, "Message identifier already used.");
      return previous;
    }
    if (
      data.replyTo &&
      !(await Message.exists({
        _id: data.replyTo,
        conversationId: conversation._id,
      }))
    )
      throw new AppError(400, "The original message could not be found.");
    let message;
    try {
      message = await Message.create({
        ...data,
        sender: userId,
        readBy: [userId],
        deliveredTo: [userId],
      });
    } catch (e) {
      if (e.code === 11000)
        return populateMessage(
          Message.findOne({ sender: userId, clientId: data.clientId }),
        );
      throw e;
    }
    await Conversation.updateOne(
      {
        _id: conversation._id,
        $or: [{ lastMessage: null }, { lastMessage: { $lt: message._id } }],
      },
      { $set: { lastMessage: message._id } },
    );
    message = await populateMessage(Message.findById(message._id));
    emit(conversation, "message:new", message);
    emit(conversation, "conversation:changed", {
      conversationId: String(conversation._id),
    });
    return message;
  }
  async function receipt(userId, conversationId, throughId, read) {
    const conversation = await member(conversationId, userId);
    id.parse(throughId);
    if (!(await Message.exists({ _id: throughId, conversationId })))
      throw new AppError(404, "Message not found.");
    const update = { deliveredTo: userId };
    if (read) update.readBy = userId;
    await Message.updateMany(
      { conversationId, _id: { $lte: throughId } },
      { $addToSet: update },
    );
    emit(conversation, "message:receipt", {
      conversationId,
      userId: String(userId),
      throughId,
      read,
    });
    io.to(userRoom(userId)).emit("conversation:changed", { conversationId });
  }
  async function remove(userId, messageId) {
    id.parse(messageId);
    const message = await Message.findOne({ _id: messageId, sender: userId });
    if (!message) throw new AppError(404, "Message not found.");
    const conversation = await member(String(message.conversationId), userId);
    message.text = "";
    message.deletedAt = new Date();
    await message.save();
    emit(conversation, "message:deleted", {
      conversationId: String(conversation._id),
      messageId,
    });
    emit(conversation, "conversation:changed", {
      conversationId: String(conversation._id),
    });
  }
  async function conversations(userId) {
    const rows = await Conversation.find({ participants: userId })
      .populate("participants")
      .populate("lastMessage")
      .sort({ updatedAt: -1 })
      .lean();
    return Promise.all(
      rows.map(async (c) => ({
        ...c,
        participants: c.participants.map(presentUser),
        unread: await Message.countDocuments({
          conversationId: c._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        }),
      })),
    );
  }
  async function start(userId, otherId) {
    otherId = id.parse(otherId).toLowerCase();
    if (String(userId) === otherId)
      throw new AppError(400, "Choose someone else to message.");
    if (!(await User.exists({ _id: otherId })))
      throw new AppError(404, "Person not found.");
    const pair = [String(userId), otherId].sort();
    let conversation;
    try {
      conversation = await Conversation.findOneAndUpdate(
        { pairKey: pair.join(":") },
        { $setOnInsert: { participants: pair } },
        { upsert: true, new: true },
      );
    } catch (e) {
      if (e.code !== 11000) throw e;
      conversation = await Conversation.findOne({ pairKey: pair.join(":") });
    }
    emit(conversation, "conversation:changed", {
      conversationId: String(conversation._id),
    });
    return { _id: String(conversation._id) };
  }
  return {
    presentUser,
    member,
    emit,
    send,
    receipt,
    remove,
    conversations,
    start,
    populateMessage,
  };
}
