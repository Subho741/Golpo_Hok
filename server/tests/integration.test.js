import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as connect } from "socket.io-client";
import { createApp } from "../app.js";
import { User, Conversation, Message, Session } from "../models/index.js";
let mongo, app, base, a, b, c, conversation, sa, sb;
const origin = "http://localhost:5173";
const cfg = {
  jwtSecret: "integration-test-only-secret-at-least-32-chars",
  clientUrl: origin,
  production: false,
};
const sockets = [];
async function request(path, { cookie, body, method = "GET" } = {}) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function start() {
  app = createApp(cfg);
  await new Promise((resolve) =>
    app.httpServer.listen(0, "127.0.0.1", resolve),
  );
  base = `http://127.0.0.1:${app.httpServer.address().port}`;
}
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const listener = (data) => {
      if (predicate(data)) {
        clearTimeout(timer);
        socket.off(name, listener);
        resolve(data);
      }
    };
    const timer = setTimeout(() => {
      socket.off(name, listener);
      reject(new Error(`Timed out: ${name}`));
    }, 5000);
    socket.on(name, listener);
  });
}
async function socket(cookie) {
  const s = connect(base, {
    autoConnect: false,
    transports: ["websocket"],
    extraHeaders: { Origin: origin, Cookie: cookie },
  });
  sockets.push(s);
  const connected = event(s, "connect");
  s.connect();
  await connected;
  return s;
}
const emit = (s, name, data) =>
  new Promise((resolve, reject) =>
    s
      .timeout(5000)
      .emit(name, data, (err, result) => (err ? reject(err) : resolve(result))),
  );
before(async () => {
  if (!process.env.TEST_MONGODB_URI) mongo = await MongoMemoryServer.create();
  await mongoose.connect(process.env.TEST_MONGODB_URI || mongo.getUri(), {
    dbName: `thread_test_${crypto.randomUUID().replaceAll("-", "")}`,
    serverSelectionTimeoutMS: 5000,
  });
  await Promise.all([
    User.init(),
    Conversation.init(),
    Message.init(),
    Session.init(),
  ]);
  await start();
});
after(async () => {
  sockets.forEach((s) => s.disconnect());
  if (app) await new Promise((resolve) => app.io.close(resolve));
  if (mongoose.connection.readyState) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongo) await mongo.stop();
});
test("registration, duplicate email, login, restoration and invalid auth", async () => {
  a = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Arjun Mehta",
      email: "arjun@example.com",
      password: "Arjun-password-123",
    },
  });
  b = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Riya Sen",
      email: "riya@example.com",
      password: "Riya-password-123",
    },
  });
  c = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Rahul Das",
      email: "rahul@example.com",
      password: "Rahul-password-123",
    },
  });
  assert.equal(a.status, 200);
  assert.ok(a.cookie);
  assert.equal(
    (await request("/auth/me", { cookie: a.cookie })).data.user.name,
    "Arjun Mehta",
  );
  assert.equal(
    (
      await request("/auth/register", {
        method: "POST",
        body: {
          name: "Arjun",
          email: "arjun@example.com",
          password: "Arjun-password-123",
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "arjun@example.com", password: "wrong" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        method: "POST",
        body: { email: "arjun@example.com", password: "Arjun-password-123" },
      })
    ).status,
    200,
  );
  assert.equal((await request("/conversations")).status, 401);
  assert.equal(
    (await request("/conversations", { cookie: "thread_session=invalid" }))
      .status,
    401,
  );
  assert.notEqual(
    (await User.findById(a.data.user._id).select("+password")).password,
    "Arjun-password-123",
  );
});
test("user search, atomic conversation creation and membership protection", async () => {
  assert.equal(
    (await request("/users?q=Riya", { cookie: a.cookie })).data.users[0].name,
    "Riya Sen",
  );
  const started = await request("/conversations", {
    cookie: a.cookie,
    method: "POST",
    body: { userId: b.data.user._id },
  });
  conversation = started.data._id;
  assert.equal(
    (
      await request("/conversations", {
        cookie: b.cookie,
        method: "POST",
        body: { userId: a.data.user._id },
      })
    ).data._id,
    conversation,
  );
  assert.equal(
    (
      await request(`/conversations/${conversation}/messages`, {
        cookie: c.cookie,
      })
    ).status,
    404,
  );
});
test("real sockets: instant delivery, typing, unread, receipts, idempotent retry and replies", async () => {
  sa = await socket(a.cookie);
  const presence = event(
    sa,
    "presence",
    (e) => e.userId === b.data.user._id && e.online,
  );
  sb = await socket(b.cookie);
  await presence;
  const typing = event(sb, "typing", (e) => e.active);
  assert.ok(
    (await emit(sa, "typing", { conversationId: conversation, active: true }))
      .ok,
  );
  await typing;
  const received = event(sb, "message:new");
  const payload = {
    conversationId: conversation,
    text: "Are you coming to the meeting?",
    clientId: crypto.randomUUID(),
  };
  const sent = await emit(sa, "message:send", payload);
  assert.ok(sent.ok);
  assert.equal((await received)._id, sent.message._id);
  assert.equal(
    (await request("/conversations", { cookie: b.cookie })).data
      .conversations[0].unread,
    1,
  );
  assert.equal(
    (await emit(sa, "message:send", payload)).message._id,
    sent.message._id,
  );
  assert.equal(
    await Message.countDocuments({ conversationId: conversation }),
    1,
  );
  const delivery = event(
    sa,
    "message:receipt",
    (e) => e.userId === b.data.user._id && !e.read,
  );
  await emit(sb, "message:delivered", {
    conversationId: conversation,
    throughId: sent.message._id,
  });
  await delivery;
  const read = event(sa, "message:receipt", (e) => e.read);
  await request(`/conversations/${conversation}/read`, {
    cookie: b.cookie,
    method: "POST",
    body: { throughId: sent.message._id },
  });
  await read;
  assert.equal(
    (await request("/conversations", { cookie: b.cookie })).data
      .conversations[0].unread,
    0,
  );
  const reply = await emit(sb, "message:send", {
    conversationId: conversation,
    text: "Yes, around six.",
    clientId: crypto.randomUUID(),
    replyTo: sent.message._id,
  });
  assert.equal(reply.message.replyTo.text, payload.text);
  assert.equal(
    (
      await request(`/messages/${sent.message._id}`, {
        cookie: b.cookie,
        method: "DELETE",
      })
    ).status,
    404,
  );
  const deleted = event(sb, "message:deleted");
  await request(`/messages/${sent.message._id}`, {
    cookie: a.cookie,
    method: "DELETE",
  });
  await deleted;
  assert.equal(
    (
      await request(`/conversations/${conversation}/messages`, {
        cookie: b.cookie,
      })
    ).data.messages[0].text,
    "",
  );
});
test("profile changes, multiple tabs, offline presence and logout revocation", async () => {
  const profile = await request("/users/me", {
    cookie: a.cookie,
    method: "PATCH",
    body: { name: "Arjun Mehta", status: "Back after lunch", avatar: "" },
  });
  assert.equal(profile.data.user.status, "Back after lunch");
  const second = await socket(b.cookie);
  sb.disconnect();
  assert.equal(
    (
      await request("/conversations", { cookie: a.cookie })
    ).data.conversations[0].participants.find((p) => p._id === b.data.user._id)
      .online,
    true,
  );
  const offline = event(
    sa,
    "presence",
    (e) => e.userId === b.data.user._id && !e.online,
  );
  second.disconnect();
  await offline;
  assert.equal(
    (await request("/auth/logout", { cookie: b.cookie, method: "POST" }))
      .status,
    200,
  );
  assert.equal((await request("/auth/me", { cookie: b.cookie })).status, 401);
});
test("server restart preserves messages and cookie-backed authentication", async () => {
  sockets.forEach((s) => s.disconnect());
  await new Promise((resolve) => app.io.close(resolve));
  await start();
  assert.equal((await request("/auth/me", { cookie: a.cookie })).status, 200);
  const result = await request(`/conversations/${conversation}/messages`, {
    cookie: a.cookie,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.messages.length, 2);
});
