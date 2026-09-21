import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import {
  registerInput,
  profileInput,
  messageInput,
  id,
} from "../middleware/validation.js";
const secret = "a-test-only-secret-that-is-over-32-characters";
test("registration normalizes email and rejects weak or oversized passwords", () => {
  assert.equal(
    registerInput.parse({
      name: " Riya Sen ",
      email: "RIYA@example.com",
      password: "long-password",
    }).email,
    "riya@example.com",
  );
  assert.throws(() =>
    registerInput.parse({ name: "A", email: "bad", password: "short" }),
  );
  assert.throws(() =>
    registerInput.parse({
      name: "Riya",
      email: "r@example.com",
      password: "🔒".repeat(20),
    }),
  );
});
test("message input requires membership identifier, UUID and nonempty bounded text", () => {
  const input = {
    conversationId: "123456789012345678901234",
    clientId: crypto.randomUUID(),
    text: "  Hello  ",
  };
  assert.equal(messageInput.parse(input).text, "Hello");
  assert.throws(() => messageInput.parse({ ...input, text: " " }));
  assert.throws(() => messageInput.parse({ ...input, text: "x".repeat(4001) }));
  assert.throws(() =>
    messageInput.parse({ ...input, conversationId: { $ne: null } }),
  );
  assert.throws(() => id.parse("../users"));
});
test("profile rejects HTML, SVG and forged image payloads", () => {
  const base = { name: "Riya Sen", status: "Available", avatar: "" };
  assert.equal(profileInput.parse(base).avatar, "");
  assert.throws(() =>
    profileInput.parse({ ...base, avatar: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    profileInput.parse({
      ...base,
      avatar: "data:image/png;base64,PHNjcmlwdD4=",
    }),
  );
});
test("bcrypt hashes and verifies passwords without storing plaintext", async () => {
  const password = "a-long-private-password";
  const hashed = await bcrypt.hash(password, 12);
  assert.notEqual(hashed, password);
  assert.ok(await bcrypt.compare(password, hashed));
  assert.equal(await bcrypt.compare("incorrect", hashed), false);
});
test("invalid and expired JWTs are rejected before database access", async () => {
  for (const token of [
    "garbage",
    jwt.sign({ sub: "123456789012345678901234" }, secret, {
      expiresIn: -1,
      issuer: "thread",
      audience: "thread-web",
    }),
  ])
    await assert.rejects(() => authenticate(token, { jwtSecret: secret }), {
      status: 401,
    });
});
test("server fails fast for missing or placeholder secrets", () => {
  assert.throws(() =>
    config({ mongoUri: "mongodb://localhost/test", jwtSecret: "short" }),
  );
  assert.throws(() =>
    config({
      mongoUri: "mongodb://localhost/test",
      jwtSecret: "replace-with-at-least-32-random-characters",
    }),
  );
});
