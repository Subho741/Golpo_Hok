import { useEffect, useRef, useState } from "react";
import { SendHorizontal, X, CornerUpLeft } from "lucide-react";
export default function MessageInput({
  conversationId,
  onSend,
  reply,
  onCancelReply,
  connected,
  socketRef,
}) {
  const [text, setText] = useState("");
  const ref = useRef(null),
    lastTyping = useRef(0),
    timer = useRef(null);
  useEffect(() => {
    if (reply) ref.current?.focus();
  }, [reply]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      socketRef.current?.emit("typing", { conversationId, active: false });
    },
    [conversationId, socketRef],
  );
  function change(value) {
    setText(value);
    clearTimeout(timer.current);
    if (Date.now() - lastTyping.current > 900) {
      socketRef.current?.emit("typing", { conversationId, active: !!value });
      lastTyping.current = Date.now();
    }
    timer.current = setTimeout(
      () =>
        socketRef.current?.emit("typing", { conversationId, active: false }),
      2000,
    );
  }
  function send(e) {
    e?.preventDefault();
    if (!text.trim() || !connected) return;
    onSend(text.trim(), reply);
    setText("");
    onCancelReply();
    clearTimeout(timer.current);
    socketRef.current?.emit("typing", { conversationId, active: false });
    ref.current?.focus();
  }
  return (
    <div className="composer-area">
      {reply && (
        <div className="reply-preview">
          <CornerUpLeft size={18} />
          <span>
            <strong>Replying to message</strong>
            <span>{reply.text}</span>
          </span>
          <button
            className="icon-button"
            aria-label="Cancel reply"
            onClick={onCancelReply}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <form className="composer" onSubmit={send}>
        <textarea
          ref={ref}
          rows={1}
          maxLength={4000}
          aria-label="Message"
          placeholder={
            connected ? "Write a message…" : "Waiting for connection…"
          }
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="send-button"
          aria-label="Send message"
          disabled={!text.trim() || !connected}
        >
          <SendHorizontal size={21} />
        </button>
      </form>
      <div className="composer-hint">
        <span>
          Enter to send <span>·</span> Shift + Enter for a new line
        </span>
        {text.length > 3500 && <span>{text.length}/4000</span>}
      </div>
    </div>
  );
}
