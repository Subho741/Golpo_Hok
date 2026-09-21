import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
     
      <span>
        গল্প হোক !<span className="brand-period"></span>
      </span>
    </div>
  );
}
export function Avatar({ user, size = "", presence = false }) {
  return (
    <span
      className={`avatar ${size}`}
      style={{
        "--avatar-color": ["#e7ebe0", "#e9e3dc", "#dce9e7", "#e5e5ed"][
          (user?.name?.charCodeAt(0) || 0) % 4
        ],
      }}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" />
      ) : (
        (user?.name || "?")
          .split(" ")
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
          .toUpperCase()
      )}
      {presence && user?.online && <i className="online-dot" />}
    </span>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function time(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
export function lastSeen(user) {
  if (user?.online) return "Online now";
  if (!user?.lastSeen) return "Offline";
  const d = new Date(user.lastSeen);
  return `Last seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time(d)}`;
}
