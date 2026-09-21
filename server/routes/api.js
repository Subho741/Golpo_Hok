import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { User, Message } from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { AppError } from "../middleware/errors.js";
import { id, profileInput } from "../middleware/validation.js";
import { authController } from "../controllers/auth.js";
export function apiRoutes(cfg, chat, io) {
  const router = Router();
  const controller = authController(cfg, chat, io);
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in 15 minutes." },
  });
  router.post("/auth/register", authLimit, controller.register);
  router.post("/auth/login", authLimit, controller.login);
  router.use(auth(cfg));
  router.get("/auth/me", (req, res) =>
    res.json({ user: chat.presentUser(req.user) }),
  );
  router.post("/auth/logout", controller.logout);
  router.patch("/users/me", async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: profileInput.parse(req.body) },
      { new: true, runValidators: true },
    );
    const contacts = await chat.conversations(req.user._id);
    const rooms = new Set([`user:${user._id}`]);
    contacts.forEach((c) =>
      c.participants.forEach((p) => rooms.add(`user:${p._id}`)),
    );
    io.to([...rooms]).emit("profile:changed", chat.presentUser(user));
    res.json({ user: chat.presentUser(user) });
  });
  router.get("/users", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) return res.json({ users: [] });
    if (q.length > 100) throw new AppError(400, "Search is too long.");
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { email: q.toLowerCase() },
      ],
    }).limit(20);
    res.json({ users: users.map(chat.presentUser) });
  });
  router.get("/conversations", async (req, res) =>
    res.json({ conversations: await chat.conversations(req.user._id) }),
  );
  router.post("/conversations", async (req, res) =>
    res.status(201).json(await chat.start(req.user._id, req.body.userId)),
  );
  router.get("/conversations/:id/messages", async (req, res) => {
    await chat.member(req.params.id, req.user._id);
    const query = { conversationId: req.params.id };
    if (req.query.before) query._id = { $lt: id.parse(req.query.before) };
    const messages = await chat
      .populateMessage(Message.find(query).sort({ _id: -1 }).limit(51))
      .lean();
    const hasMore = messages.length > 50;
    if (hasMore) messages.pop();
    res.json({ messages: messages.reverse(), hasMore });
  });
  router.post("/messages", async (req, res) =>
    res.status(201).json({ message: await chat.send(req.user._id, req.body) }),
  );
  router.delete("/messages/:id", async (req, res) => {
    await chat.remove(req.user._id, req.params.id);
    res.json({ ok: true });
  });
  router.post("/conversations/:id/read", async (req, res) => {
    await chat.receipt(req.user._id, req.params.id, req.body.throughId, true);
    res.json({ ok: true });
  });
  return router;
}
