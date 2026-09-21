import { useState } from "react";
import { Search, SquarePen, Settings2, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Brand, time } from "./Common";
export default function ChatSidebar({
  chat,
  user,
  selected,
  onNew,
  onProfile,
}) {
  const [query, setQuery] = useState("");
  const rows = chat.conversations.filter((c) =>
    c.participants.some(
      (p) =>
        p._id !== user._id &&
        p.name.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  return (
    <aside className={`sidebar ${selected ? "mobile-hidden" : ""}`}>
      <header className="sidebar-top">
        <Brand />
        <button
          className="icon-button"
          title="New conversation"
          aria-label="New conversation"
          onClick={onNew}
        >
          <SquarePen size={21} />
        </button>
      </header>
      <div className="sidebar-heading">
        <h1>Messages</h1>
        <span className="small muted">{chat.conversations.length}</span>
      </div>
      <label className="search">
        <Search size={18} />
        <input
          aria-label="Search conversations"
          placeholder="Search conversations"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <div className="list-caption">ALL CONVERSATIONS</div>
      <nav className="conversation-list" aria-label="Conversations">
        {chat.loading ? (
          <div className="skeleton-list" aria-label="Loading conversations">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton" />
            ))}
          </div>
        ) : rows.length ? (
          rows.map((c) => {
            const other = c.participants.find((p) => p._id !== user._id);
            return (
              <Link
                key={c._id}
                to={`/chat/${c._id}`}
                className={`conversation-item ${selected === c._id ? "selected" : ""}`}
                aria-current={selected === c._id ? "page" : undefined}
              >
                <Avatar user={other} presence />
                <span className="conversation-copy">
                  <span className="conversation-title">
                    <strong>{other.name}</strong>
                    {c.lastMessage && (
                      <time>{time(c.lastMessage.createdAt)}</time>
                    )}
                  </span>
                  <span className="conversation-preview">
                    <span className={chat.typing[c._id] ? "typing-copy" : ""}>
                      {chat.typing[c._id]
                        ? "Typing…"
                        : c.lastMessage
                          ? (c.lastMessage.sender === user._id ? "You: " : "") +
                            (c.lastMessage.deletedAt
                              ? "Message deleted"
                              : c.lastMessage.text)
                          : "Say hello"}
                    </span>
                    {c.unread > 0 && (
                      <b className="unread">
                        {c.unread > 99 ? "99+" : c.unread}
                      </b>
                    )}
                  </span>
                </span>
              </Link>
            );
          })
        ) : (
          <div className="sidebar-empty">
            <MessageSquare size={25} />
            <p>
              {query
                ? "No conversations found."
                : "Your conversations will appear here."}
            </p>
            {!query && (
              <button className="text-button" onClick={onNew}>
                Start a conversation
              </button>
            )}
          </div>
        )}
      </nav>
      <div className="sidebar-account">
        <button onClick={onProfile} className="account-button">
          <Avatar user={user} size="small-avatar" />
          <span>
            <strong>{user.name}</strong>
            <span className="small muted">Your profile</span>
          </span>
          <Settings2 size={18} />
        </button>
        <div className={`connection ${chat.connection}`}>
          <i />
          {chat.connection === "connected"
            ? "Connected"
            : chat.connection === "connecting"
              ? "Connecting…"
              : "Offline · reconnecting…"}
        </div>
      </div>
    </aside>
  );
}
