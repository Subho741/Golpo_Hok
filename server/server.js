import mongoose from "mongoose";
import { config } from "./config/env.js";
import { createApp } from "./app.js";
import { User, Conversation, Message, Session } from "./models/index.js";
const cfg = config();
await mongoose.connect(cfg.mongoUri, { serverSelectionTimeoutMS: 10000 });
await Promise.all([
  User.init(),
  Conversation.init(),
  Message.init(),
  Session.init(),
]);
const { httpServer, io, drainPresence } = createApp(cfg);
httpServer.listen(cfg.port, "0.0.0.0", () =>
  console.log(`Thread listening on port ${cfg.port}`),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await new Promise((resolve) => io.close(resolve));
  await drainPresence();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
