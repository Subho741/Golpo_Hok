import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Session } from "../models/index.js";
import { registerInput, loginInput } from "../middleware/validation.js";
import { AppError } from "../middleware/errors.js";
import { cookieName, cookieOptions } from "../middleware/auth.js";
export function authController(cfg, chat, io) {
  async function signIn(user, res) {
    const sid = randomUUID();
    await Session.create({
      _id: sid,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    const token = jwt.sign({}, cfg.jwtSecret, {
      algorithm: "HS256",
      subject: String(user._id),
      jwtid: sid,
      expiresIn: "7d",
      issuer: "thread",
      audience: "thread-web",
    });
    res
      .cookie(cookieName, token, cookieOptions(cfg))
      .json({ user: chat.presentUser(user) });
  }
  return {
    register: async (req, res) => {
      const data = registerInput.parse(req.body);
      const user = await User.create({
        ...data,
        password: await bcrypt.hash(data.password, 12),
      });
      await signIn(user, res);
    },
    login: async (req, res) => {
      const data = loginInput.parse(req.body);
      const user = await User.findOne({ email: data.email }).select(
        "+password",
      );
      // A fixed valid hash equalizes the bcrypt work for unknown addresses.
      const valid = await bcrypt.compare(
        data.password,
        user?.password ||
          "$2b$12$7EqJtq98hPqEX7fNZaFWoO5qT.9uS9cLjXadMQDfFGIgbmHWEXrXy",
      );
      if (!user || !valid)
        throw new AppError(401, "Email or password is incorrect.");
      await signIn(user, res);
    },
    logout: async (req, res) => {
      await Session.deleteOne({ _id: req.sessionId });
      io.in(`session:${req.sessionId}`).disconnectSockets(true);
      const { maxAge, ...options } = cookieOptions(cfg);
      res.clearCookie(cookieName, options).json({ ok: true });
    },
  };
}
