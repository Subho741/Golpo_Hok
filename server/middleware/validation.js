import { z } from "zod";
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");
const name = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters for your name.")
  .max(60);
const email = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254)
  .transform((s) => s.toLowerCase());
const password = z
  .string()
  .min(10, "Use at least 10 characters for your password.")
  .refine(
    (v) => Buffer.byteLength(v) <= 72,
    "Password must be at most 72 bytes.",
  );
export const registerInput = z.object({ name, email, password });
export const loginInput = z.object({
  email,
  password: z.string().min(1).max(200),
});
const avatar = z
  .string()
  .max(280000)
  .refine((value) => {
    if (!value) return true;
    const match = value.match(
      /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
    );
    if (!match) return false;
    const b = Buffer.from(match[2], "base64");
    if (b.length > 200000) return false;
    return match[1] === "png"
      ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : b.toString("ascii", 0, 4) === "RIFF" &&
          b.toString("ascii", 8, 12) === "WEBP";
  }, "Choose a PNG, JPEG, or WebP profile picture.");
export const profileInput = z.object({
  name,
  status: z.string().trim().max(100),
  avatar,
});
export const messageInput = z.object({
  conversationId: id,
  text: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(4000, "Keep messages under 4,000 characters."),
  clientId: z.string().uuid(),
  replyTo: id.nullish(),
});
