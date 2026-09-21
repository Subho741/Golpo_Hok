import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function restore() {
    setLoading(true);
    setError("");
    try {
      setUser((await api("/auth/me")).user);
    } catch (e) {
      if (e.status !== 401)
        setError(
          "Could not connect to Thread. Check your connection and try again.",
        );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    restore();
    const ended = () => setUser(null);
    window.addEventListener("session-ended", ended);
    return () => window.removeEventListener("session-ended", ended);
  }, []);
  async function login(fields, register) {
    setUser(
      (
        await api(`/auth/${register ? "register" : "login"}`, {
          method: "POST",
          body: fields,
        })
      ).user,
    );
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, error, restore, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
