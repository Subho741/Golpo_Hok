import jwt from "jsonwebtoken";
import { Session, User } from "../models/index.js";
import { AppError } from "./errors.js";
export const cookieName = "thread_session";
export function cookieOptions(cfg) {
  return {
    httpOnly: true,
    secure: cfg.production,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400000,
  };
}
export async function authenticate(token, cfg) {
  try {
    const claims = jwt.verify(token || "", cfg.jwtSecret, {
      algorithms: ["HS256"],
      issuer: "thread",
      audience: "thread-web",
    });
    const session = await Session.findOne({
      _id: claims.jti,
      user: claims.sub,
      expiresAt: { $gt: new Date() },
    });
    if (!session) throw new Error("No session");
    const user = await User.findById(claims.sub);
    if (!user) throw new Error("No user");
    return { user, sessionId: claims.jti, expiresAt: claims.exp * 1000 };
  } catch (error) {
    if (error.name?.includes("Mongo")) throw error;
    throw new AppError(401, "Your session has ended. Please sign in again.");
  }
}
export function auth(cfg) {
  return async (req, res, next) => {
    try {
      Object.assign(req, await authenticate(req.cookies[cookieName], cfg));
      next();
    } catch (e) {
      next(e);
    }
  };
}
