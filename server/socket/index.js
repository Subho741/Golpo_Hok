import { authenticate, cookieName } from "../middleware/auth.js";
import { publicError, AppError } from "../middleware/errors.js";
import { Conversation, User } from "../models/index.js";
import { userRoom } from "../services/chat.js";
export function configureSockets(io, cfg, chat, online) {
  io.use(async (socket, next) => {
    try {
      const cookies = Object.fromEntries(
        (socket.handshake.headers.cookie || "")
          .split(";")
          .filter((s) => s.includes("="))
          .map((s) => {
            const at = s.indexOf("=");
            return [s.slice(0, at).trim(), decodeURIComponent(s.slice(at + 1))];
          }),
      );
      socket.data.token = cookies[cookieName];
      Object.assign(socket.data, await authenticate(socket.data.token, cfg));
      next();
    } catch (e) {
      next(new Error(publicError(e).message));
    }
  });
  const presenceQueues = new Map();
  function presence(uid) {
    const previous = presenceQueues.get(uid) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const isOnline = online.has(uid);
        const lastSeen = new Date();
        if (!isOnline)
          await User.updateOne({ _id: uid }, { $set: { lastSeen } });
        const conversations = await Conversation.find({
          participants: uid,
        }).select("participants");
        const rooms = new Set([userRoom(uid)]);
        conversations.forEach((c) =>
          c.participants.forEach((p) => rooms.add(userRoom(p))),
        );
        io.to([...rooms]).emit("presence", {
          userId: uid,
          online: isOnline,
          lastSeen,
        });
      })
      .catch(console.error)
      .finally(() => {
        if (presenceQueues.get(uid) === next) presenceQueues.delete(uid);
      });
    presenceQueues.set(uid, next);
  }
  io.on("connection", (socket) => {
    const uid = String(socket.data.user._id);
    socket.join([userRoom(uid), `session:${socket.data.sessionId}`]);
    const sockets = online.get(uid) || new Set();
    sockets.add(socket.id);
    online.set(uid, sockets);
    presence(uid);
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.expiresAt - Date.now()),
    );
    let bucket = 80,
      windowStart = Date.now();
    function handle(event, fn) {
      socket.on(event, async (data, ack) => {
        const respond = typeof ack === "function" ? ack : () => {};
        try {
          if (Date.now() - windowStart > 10000) {
            bucket = 80;
            windowStart = Date.now();
          }
          if (--bucket < 0)
            throw new AppError(429, "Slow down for a moment, then try again.");
          await authenticate(socket.data.token, cfg);
          respond({ ok: true, ...(await fn(data || {})) });
        } catch (e) {
          const err = publicError(e);
          respond({ ok: false, error: err.message, status: err.status });
          if (err.status === 401) socket.disconnect(true);
        }
      });
    }
    handle("message:send", async (data) => ({
      message: await chat.send(uid, data),
    }));
    handle("message:delivered", async (data) => {
      await chat.receipt(uid, data.conversationId, data.throughId, false);
      return {};
    });
    handle("typing", async (data) => {
      const conversation = await chat.member(data.conversationId, uid);
      socket
        .to(conversation.participants.map(userRoom))
        .emit("typing", {
          conversationId: String(conversation._id),
          userId: uid,
          active: data.active === true,
        });
      return {};
    });
    socket.on("disconnect", () => {
      clearTimeout(expiry);
      const current = online.get(uid);
      current?.delete(socket.id);
      if (!current?.size) {
        online.delete(uid);
        presence(uid);
      }
    });
  });
  return {
    drainPresence: async () => {
      await Promise.all([...presenceQueues.values()]);
    },
  };
}
