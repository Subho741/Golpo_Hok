import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Info, ArrowDown, MessageSquare, X } from "lucide-react";
import { Avatar, lastSeen, Modal } from "./Common";
import { ContactPanel } from "./Panels";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import { useMessages } from "../hooks/useMessages";
export default function ConversationView({ conversation, chat, user }) {
  const other = conversation.participants.find((p) => p._id !== user._id),
    state = useMessages(chat, conversation._id, user);
  const [reply, setReply] = useState(null),
    [contact, setContact] = useState(false),
    [deleteId, setDeleteId] = useState(null),
    [atBottom, setAtBottom] = useState(true);
  const scroll = useRef(null),
    bottom = useRef(true),
    prepend = useRef(null);
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    if (prepend.current !== null) {
      el.scrollTop = el.scrollHeight - prepend.current;
      prepend.current = null;
    } else if (bottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.messages]);
  useEffect(() => {
    if (atBottom) state.markRead();
  }, [state.messages, atBottom]);
  useEffect(() => {
    const read = () => {
      if (bottom.current) state.markRead();
    };
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [state.messages]);
  const dateLabel = (value) =>
    new Date(value).toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  return (
    <section className="conversation-pane">
      <header className="chat-header">
        <Link
          to="/"
          className="icon-button mobile-back"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={21} />
        </Link>
        <Avatar user={other} presence />
        <button className="contact-name" onClick={() => setContact(true)}>
          <strong>{other.name}</strong>
          <span className={other.online ? "online-text" : "muted"}>
            {chat.typing[conversation._id] ? "Typing…" : lastSeen(other)}
          </span>
        </button>
        <button
          className="icon-button"
          aria-label="Contact details"
          onClick={() => setContact(true)}
        >
          <Info size={21} />
        </button>
      </header>
      {state.error && (
        <div className="inline-error" role="alert">
          <span>{state.error}</span>
          <button
            onClick={() => {
              state.setError("");
              state.load();
            }}
          >
            Retry
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => state.setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div
        className="message-scroll"
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 65;
          bottom.current = near;
          setAtBottom(near);
        }}
      >
        {state.loading ? (
          <div className="message-loading" role="status">
            Loading messages…
          </div>
        ) : !state.messages.length ? (
          <div className="first-message">
            <Avatar user={other} size="large-avatar" />
            <h2>
              This is the start of your conversation
              <br />
              with {other.name.split(" ")[0]}.
            </h2>
            <p className="muted">A simple hello is a good place to begin.</p>
          </div>
        ) : (
          <>
            <div className="conversation-start">
              <MessageSquare size={15} />
              <span>Just you and {other.name.split(" ")[0]}.</span>
            </div>
            {state.hasMore && (
              <button
                className="load-older"
                disabled={state.loadingOlder}
                onClick={async () => {
                  prepend.current = scroll.current.scrollHeight;
                  await state.older();
                }}
              >
                {state.loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            )}
            {state.messages.map((m, i) => (
              <div key={m.clientId || m._id}>
                {(i === 0 ||
                  dateLabel(state.messages[i - 1].createdAt) !==
                    dateLabel(m.createdAt)) && (
                  <div className="date-divider">
                    <span>{dateLabel(m.createdAt)}</span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  own={m.sender === user._id}
                  other={other}
                  onReply={() => setReply(m)}
                  onDelete={() => setDeleteId(m._id)}
                  onRetry={() => state.send(null, null, m)}
                />
              </div>
            ))}
          </>
        )}
        {chat.typing[conversation._id] && (
          <div className="typing-indicator" role="status">
            <span />
            <span />
            <span />
            <small>{other.name.split(" ")[0]} is typing</small>
          </div>
        )}
      </div>
      {!atBottom && (
        <button
          className="scroll-bottom"
          onClick={() => {
            bottom.current = true;
            setAtBottom(true);
            scroll.current.scrollTo({
              top: scroll.current.scrollHeight,
              behavior: "smooth",
            });
          }}
          aria-label="Scroll to latest messages"
        >
          <ArrowDown size={18} /> Latest messages
        </button>
      )}
      <MessageInput
        conversationId={conversation._id}
        onSend={(text, reply) => {
          bottom.current = true;
          setAtBottom(true);
          state.send(text, reply);
        }}
        reply={reply}
        onCancelReply={() => setReply(null)}
        connected={chat.connection === "connected"}
        socketRef={chat.socketRef}
      />
      {contact && (
        <ContactPanel user={other} onClose={() => setContact(false)} />
      )}
      {deleteId && (
        <Modal title="Delete this message?" onClose={() => setDeleteId(null)}>
          <p className="muted">
            It will be removed for both people. This can’t be undone.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setDeleteId(null)}>
              Keep message
            </button>
            <button
              className="danger"
              onClick={() => {
                state.remove(deleteId);
                setDeleteId(null);
              }}
            >
              Delete message
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
