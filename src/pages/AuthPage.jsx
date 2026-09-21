import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Brand } from "../components/Common";
import { useAuth } from "../context/AuthContext";
export default function AuthPage() {
  const { user, login } = useAuth(),
    location = useLocation();
  const register = location.pathname === "/register";
  const [fields, setFields] = useState({ name: "", email: "", password: "" }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(fields, register);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <header>
        <Brand />
        <span className="small muted">A little closer, wherever you are.</span>
      </header>
      <div className="auth-content">
        <section className="auth-intro">
          <div className="eyebrow">GOOD CONVERSATIONS START HERE</div>
          <h1>
            Make room for
            <br />a conversation.
          </h1>
          <p>
            The quick question. The catch-up.
            <br />
            The idea that couldn’t wait until tomorrow.
          </p>
          <div className="auth-note">
            <span className="note-line" />
            <span>Your people. One quiet place.</span>
          </div>
        </section>
        <section className="auth-form-panel">
          <h2>{register ? "Find your people." : "Good to see you."}</h2>
          <p className="muted">
            {register
              ? "Create your account to start a conversation."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {register && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  autoFocus
                  required
                  minLength={2}
                  maxLength={60}
                  value={fields.name}
                  onChange={(e) =>
                    setFields({ ...fields, name: e.target.value })
                  }
                  placeholder="Arjun Mehta"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={fields.email}
                onChange={(e) =>
                  setFields({ ...fields, email: e.target.value })
                }
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 10 : 1}
                  required
                  value={fields.password}
                  onChange={(e) =>
                    setFields({ ...fields, password: e.target.value })
                  }
                  placeholder={
                    register ? "At least 10 characters" : "Enter your password"
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "Just a moment…"
                : register
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Thread?"}{" "}
            <Link
              onClick={() => setError("")}
              to={register ? "/login" : "/register"}
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </section>
      </div>
      <footer>Thread · Space for the everyday.</footer>
    </main>
  );
}
