// Runs against a real running Thread server; does not mock authentication or sockets.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const base = process.env.TEST_BASE_URL || "http://localhost:5173";
const browser = await chromium.launch({ headless: true });
const suffix = Date.now();
const errors = [];
try {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const pa = await a.newPage(),
    pb = await b.newPage();
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  async function register(page, name, email) {
    await page.goto(base + "/register");
    await page.getByLabel("Your name").fill(name);
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("Browser-check-password-123");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Messages", exact: true })
      .waitFor();
  }
  await register(pa, `Arjun ${suffix}`, `arjun.${suffix}@example.com`);
  await register(pb, `Riya ${suffix}`, `riya.${suffix}@example.com`);
  await pa
    .getByRole("button", { name: "New conversation", exact: true })
    .first()
    .click();
  await pa
    .getByRole("textbox", { name: "Search people" })
    .fill(`riya.${suffix}@example.com`);
  await pa.getByRole("button", { name: new RegExp(`Riya ${suffix}`) }).click();
  const message = `See you at six! ${suffix}`;
  await pa.getByRole("textbox", { name: "Message", exact: true }).fill(message);
  await pa.getByRole("button", { name: "Send message", exact: true }).click();
  // The second independently authenticated browser receives the conversation without refresh.
  await pb.getByRole("link", { name: new RegExp(`Arjun ${suffix}`) }).click();
  await pb.getByText(message, { exact: true }).waitFor();
  await pa.getByLabel("Read", { exact: true }).waitFor();
  await pb
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("On my way");
  await pa.getByText("Typing…", { exact: true }).first().waitFor();
  await pb
    .getByRole("textbox", { name: "Message", exact: true })
    .press("Enter");
  await pa.getByText("On my way", { exact: true }).waitFor();
  await pb.reload();
  await pb.getByText(message, { exact: true }).waitFor();
  await b.storageState({ path: "test-results/browser-session.json" });
  await b.close();
  const restored = await browser.newContext({
    storageState: "test-results/browser-session.json",
    viewport: { width: 390, height: 844 },
  });
  const mobile = await restored.newPage();
  await mobile.goto(base);
  await mobile
    .getByRole("heading", { name: "Messages", exact: true })
    .waitFor();
  await mobile
    .getByRole("link", { name: new RegExp(`Arjun ${suffix}`) })
    .click();
  await mobile.getByText(message, { exact: true }).waitFor();
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobile.getByRole("link", { name: "Back to conversations" }).click();
  await mobile
    .getByRole("heading", { name: "Messages", exact: true })
    .waitFor();
  await mobile.getByRole("button", { name: /Your profile/ }).click();
  await mobile.getByRole("button", { name: "Sign out" }).click();
  await mobile.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two-user messaging, typing, read receipt, refresh, restored session, mobile navigation, logout, no page errors.",
  );
} finally {
  await browser.close();
  await rm("test-results/browser-session.json", { force: true });
}
