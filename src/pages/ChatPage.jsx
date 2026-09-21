import { useEffect, useState } from "react";
import { ArrowUpRight, SquarePen, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../hooks/useChat";
import ChatSidebar from "../components/ChatSidebar";
import ConversationView from "../components/ConversationView";
import { NewChat, ProfilePanel } from "../components/Panels";
export default function ChatPage() {
  const { user, setUser, logout } = useAuth(),
    chat = useChat(user, setUser),
    { id } = useParams(),
    navigate = useNavigate();
  const [newChat, setNewChat] = useState(false),
    [profile, setProfile] = useState(false);
  const selected = chat.conversations.find((c) => c._id === id);
  useEffect(() => {
    const shortcut = (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(e.target.tagName) &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        document
          .querySelector('input[aria-label="Search conversations"]')
          ?.focus();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  return (
    <main className="app-shell">
      <ChatSidebar
        chat={chat}
        user={user}
        selected={id}
        onNew={() => setNewChat(true)}
        onProfile={() => setProfile(true)}
      />
      {selected ? (
        <ConversationView
          key={id}
          conversation={selected}
          chat={chat}
          user={user}
        />
      ) : (
        <section className={`empty-pane ${!id ? "mobile-hidden" : ""}`}>
          <div className="empty-top">
  <span>YOUR EVERYDAY, TOGETHER</span>
  <span>THREAD / MESSAGES</span>
</div>

<div className="empty-content">
            <h1>
              {id
                ? "Looking for your conversation…"
                : "A small hello goes a long way."}
            </h1>
            <p>
              {id && !chat.loading
                ? "This conversation is unavailable. Choose another or start a new one."
                : "Pick a conversation, or find someone to catch up with."}
            </p>
            <button className="primary" onClick={() => setNewChat(true)}>
              <SquarePen size={17} />
              New conversation
              <ArrowUpRight size={17} />
            </button>
            {id && (
              <button className="text-button" onClick={() => navigate("/")}>
                Back to conversations
              </button>
            )}
          </div>
          <div className="empty-bottom">Make time for your people.</div>
        </section>
      )}
      {chat.error && (
        <div className="toast" role="alert">
          <span>{chat.error}</span>
          <button
            className="text-button"
            onClick={() => {
              chat.setError("");
              chat.refresh();
            }}
          >
            Retry
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss"
            onClick={() => chat.setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {newChat && (
        <NewChat
          onClose={() => setNewChat(false)}
          onStart={async (id) => {
            await chat.refresh();
            navigate(`/chat/${id}`);
            setNewChat(false);
          }}
        />
      )}
      {profile && (
        <ProfilePanel
          user={user}
          onSave={setUser}
          onLogout={logout}
          onClose={() => setProfile(false)}
        />
      )}
    </main>
  );
}
