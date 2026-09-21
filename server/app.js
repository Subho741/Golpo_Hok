import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { Server } from "socket.io";
import { apiRoutes } from "./routes/api.js";
import { createChatService } from "./services/chat.js";
import { configureSockets } from "./socket/index.js";
import { AppError, errorHandler } from "./middleware/errors.js";
export function createApp(cfg) {
  const app = express();
  app.disable("x-powered-by");
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: cfg.clientUrl, credentials: true },
    maxHttpBufferSize: 20000,
    allowRequest: (req, cb) => cb(null, req.headers.origin === cfg.clientUrl),
  });
  const online = new Map();
  const chat = createChatService(io, online);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'", cfg.clientUrl, cfg.clientUrl.replace(/^http/, "ws")],
          "upgrade-insecure-requests": cfg.production ? [] : null,
        },
      },
    }),
  );
  app.use(cors({ origin: cfg.clientUrl, credentials: true }));
  app.use(express.json({ limit: "320kb" }), cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== cfg.clientUrl
    )
      return next(new AppError(403, "Request origin is not allowed."));
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a moment." },
    }),
  );
  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api", apiRoutes(cfg, chat, io));
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "That endpoint does not exist." }),
  );
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../dist",
  );
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html")),
    );
  }
  app.use(errorHandler);
  const { drainPresence } = configureSockets(io, cfg, chat, online);
  return { app, httpServer, io, drainPresence };
}
