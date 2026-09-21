import { ZodError } from "zod";
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function publicError(err) {
  if (err instanceof ZodError)
    return {
      status: 400,
      message: err.issues[0]?.message || "Please check your input.",
    };
  if (err.code === 11000)
    return { status: 409, message: "That email is already registered." };
  if (err.name === "CastError")
    return { status: 400, message: "Invalid identifier." };
  if (err.type === "entity.too.large")
    return {
      status: 413,
      message: "The image is too large. Choose a smaller image.",
    };
  if (err instanceof AppError)
    return { status: err.status, message: err.message };
  console.error(err);
  return { status: 500, message: "Something went wrong. Please try again." };
}
export function errorHandler(err, req, res, next) {
  const e = publicError(err);
  res.status(e.status).json({ error: e.message });
}
