import {
  Check,
  CheckCheck,
  Clock,
  Reply,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { time } from "./Common";
export default function MessageBubble({
  message,
  own,
  other,
  onReply,
  onDelete,
  onRetry,
}) {
  const read = message.readBy?.includes(other._id),
    delivered = message.deliveredTo?.includes(other._id);
  const status = message.failed
    ? "Not sent"
    : message.pending
      ? "Sending"
      : read
        ? "Read"
        : delivered
          ? "Delivered"
          : "Sent";
  return (
    <div className={`message-row ${own ? "outgoing" : "incoming"}`}>
      <div className="message-unit">
        <div className={`message-bubble ${message.deletedAt ? "deleted" : ""}`}>
          {message.replyTo && (
            <blockquote>
              <span>
                {message.replyTo.sender === other._id ? other.name : "You"}
              </span>
              {message.replyTo.deletedAt
                ? "Message deleted"
                : message.replyTo.text}
            </blockquote>
          )}
          <p>
            {message.deletedAt ? "This message was deleted." : message.text}
          </p>
          <div className="message-meta">
            <time dateTime={message.createdAt}>{time(message.createdAt)}</time>
            {own && (
              <span
                className={read ? "read-status" : ""}
                title={status}
                aria-label={status}
              >
                {message.pending ? (
                  <Clock size={13} />
                ) : message.failed ? (
                  <span>Not sent</span>
                ) : delivered || read ? (
                  <CheckCheck size={15} />
                ) : (
                  <Check size={15} />
                )}
              </span>
            )}
          </div>
        </div>
        {message.failed ? (
          <button className="retry-message" onClick={onRetry}>
            <RotateCcw size={13} /> Retry
          </button>
        ) : (
          !message.pending &&
          !message.deletedAt && (
            <div className="message-actions">
              <button
                aria-label="Reply to message"
                title="Reply"
                onClick={onReply}
              >
                <Reply size={15} />
              </button>
              {own && (
                <button
                  aria-label="Delete message"
                  title="Delete"
                  onClick={onDelete}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
