export function config(overrides = {}) {
  const value = {
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    port: Number(process.env.PORT || 3001),
    clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
    production: process.env.NODE_ENV === "production",
    ...overrides,
  };
  if (!value.mongoUri) throw new Error("MONGODB_URI is required");
  if (
    !value.jwtSecret ||
    value.jwtSecret.length < 32 ||
    value.jwtSecret.startsWith("replace-")
  )
    throw new Error(
      "Set JWT_SECRET to a random value of at least 32 characters",
    );
  return value;
}
