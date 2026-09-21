import mongoose from "mongoose";
const { Schema } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: "" },
    status: { type: String, default: "", maxlength: 100 },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
const conversationSchema = new Schema(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    pairKey: { type: String, unique: true, required: true },
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true },
);
conversationSchema.index({ participants: 1, updatedAt: -1 });
const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, maxlength: 4000, default: "" },
    type: { type: String, enum: ["text"], default: "text" },
    clientId: { type: String, required: true },
    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    deliveredTo: [{ type: Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, _id: -1 });
messageSchema.index({ sender: 1, clientId: 1 }, { unique: true });
const sessionSchema = new Schema({
  _id: String,
  user: { type: Schema.Types.ObjectId, ref: "User" },
  expiresAt: Date,
});
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const User = mongoose.model("User", userSchema);
export const Conversation = mongoose.model("Conversation", conversationSchema);
export const Message = mongoose.model("Message", messageSchema);
export const Session = mongoose.model("Session", sessionSchema);
