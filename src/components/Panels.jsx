import { useEffect, useState } from "react";
import { Search, ArrowRight, LogOut, Camera } from "lucide-react";
import { api } from "../services/api";
import { Avatar, Modal, lastSeen } from "./Common";
export function NewChat({ onClose, onStart }) {
  const [query, setQuery] = useState(""),
    [users, setUsers] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [starting, setStarting] = useState("");
  useEffect(() => {
    let active = true;
    setUsers([]);
    setError("");
    setBusy(query.trim().length >= 2);
    const timeout = setTimeout(async () => {
      if (query.trim().length < 2) return;
      try {
        const result = await api(
          `/users?q=${encodeURIComponent(query.trim())}`,
        );
        if (active) setUsers(result.users);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setBusy(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);
  async function start(id) {
    setStarting(id);
    try {
      const c = await api("/conversations", {
        method: "POST",
        body: { userId: id },
      });
      await onStart(c._id);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting("");
    }
  }
  return (
    <Modal title="New conversation" onClose={onClose}>
      <p className="muted">Find someone by name or their full email address.</p>
      <label className="search modal-search">
        <Search size={18} />
        <input
          autoFocus
          placeholder="Search people"
          aria-label="Search people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="people-list">
        {busy ? (
          <p className="muted">Finding people…</p>
        ) : users.length ? (
          users.map((u) => (
            <button
              key={u._id}
              className="person-row"
              disabled={!!starting}
              onClick={() => start(u._id)}
            >
              <Avatar user={u} presence />
              <span>
                <strong>{u.name}</strong>
                <span className="muted small">{u.email}</span>
              </span>
              <ArrowRight size={18} />
            </button>
          ))
        ) : (
          <p className="muted">
            {query.trim().length >= 2
              ? "No one found. Check the spelling or ask them to join Thread."
              : "Enter at least two characters to search."}
          </p>
        )}
      </div>
    </Modal>
  );
}
async function processImage(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a PNG, JPEG, or WebP image under 5 MB.");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const edge = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - edge) / 2,
    (bitmap.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    256,
    256,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
export function ProfilePanel({ user, onClose, onSave, onLogout }) {
  const [form, setForm] = useState({
      name: user.name,
      status: user.status || "",
      avatar: user.avatar || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api("/users/me", { method: "PATCH", body: form });
      onSave(user);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      setForm((prev) => ({ ...prev, avatar: undefined }));
      const avatar = await processImage(file);
      setForm((prev) => ({ ...prev, avatar }));
    } catch (e) {
      setError(e.message);
      setForm((prev) => ({ ...prev, avatar: user.avatar || "" }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Your profile" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <div className="profile-avatar">
          <Avatar user={form} size="large-avatar" />
          <label className="upload-button">
            <Camera size={17} /> Change photo
            <input
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
          </label>
          {form.avatar && (
            <button
              className="text-button"
              type="button"
              onClick={() => setForm({ ...form, avatar: "" })}
            >
              Remove
            </button>
          )}
        </div>
        <label>
          Your name
          <input
            required
            minLength={2}
            maxLength={60}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          About you
          <input
            maxLength={100}
            placeholder="A few words about you"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
        </label>
        <label>
          Email address
          <input value={user.email} disabled />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          className="logout-button"
          disabled={busy}
          type="button"
          onClick={async () => {
            try {
              await onLogout();
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <LogOut size={17} /> Sign out
        </button>
      </form>
    </Modal>
  );
}
export function ContactPanel({ user, onClose }) {
  return (
    <Modal title="Contact details" onClose={onClose}>
      <div className="contact-profile">
        <Avatar user={user} size="large-avatar" presence />
        <h2>{user.name}</h2>
        <p className="muted">{lastSeen(user)}</p>
        <p>{user.status || "No status added."}</p>
        <p className="muted">{user.email}</p>
      </div>
    </Modal>
  );
}
