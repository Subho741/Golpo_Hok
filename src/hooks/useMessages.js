import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
function merge(prev, message) {
  const old = prev.find(
    (m) => m._id === message._id || m.clientId === message.clientId,
  );
  const combined = {
    ...old,
    ...message,
    pending: false,
    failed: false,
    readBy: [...new Set([...(old?.readBy || []), ...(message.readBy || [])])],
    deliveredTo: [
      ...new Set([...(old?.deliveredTo || []), ...(message.deliveredTo || [])]),
    ],
  };
  return [
    ...prev.filter(
      (m) => m._id !== message._id && m.clientId !== message.clientId,
    ),
    combined,
  ].sort(
    (a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt) ||
      a._id.localeCompare(b._id),
  );
}
export function useMessages(chat, conversationId, user) {
  const [messages, setMessages] = useState([]),
    [loading, setLoading] = useState(true),
    [hasMore, setHasMore] = useState(false),
    [error, setError] = useState(""),
    [loadingOlder, setLoadingOlder] = useState(false);
  const alive = useRef(true),
    readThrough = useRef(""),
    loadSequence = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSequence.current;
    try {
      const data = await api(`/conversations/${conversationId}/messages`);
      if (alive.current && seq === loadSequence.current) {
        setMessages((prev) => {
          const newest = data.messages.at(-1)?._id;
          const retained = prev.filter(
            (m) => m.pending || m.failed || (newest && m._id > newest),
          );
          return data.messages.reduce(merge, retained);
        });
        setHasMore(data.hasMore);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [conversationId]);
  useEffect(() => {
    alive.current = true;
    load();
    window.addEventListener("chat-reconnected", load);
    const wake = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive.current = false;
      window.removeEventListener("chat-reconnected", load);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [load]);
  useEffect(() => {
    chat.messageListener.current = (m) => {
      if (m.conversationId === conversationId)
        setMessages((prev) => merge(prev, m));
    };
    chat.receiptListener.current = (data) => {
      if (data.conversationId === conversationId)
        setMessages((prev) =>
          prev.map((m) =>
            !m.pending && m._id <= data.throughId
              ? {
                  ...m,
                  deliveredTo: [...new Set([...m.deliveredTo, data.userId])],
                  readBy: data.read
                    ? [...new Set([...m.readBy, data.userId])]
                    : m.readBy,
                }
              : m,
          ),
        );
    };
    chat.deleteListener.current = (data) => {
      if (data.conversationId === conversationId)
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            ...(m._id === data.messageId
              ? { text: "", deletedAt: new Date().toISOString() }
              : {}),
            replyTo:
              m.replyTo?._id === data.messageId
                ? {
                    ...m.replyTo,
                    text: "",
                    deletedAt: new Date().toISOString(),
                  }
                : m.replyTo,
          })),
        );
    };
    return () => {
      chat.messageListener.current = () => {};
      chat.receiptListener.current = () => {};
      chat.deleteListener.current = () => {};
    };
  }, [
    conversationId,
    chat.messageListener,
    chat.receiptListener,
    chat.deleteListener,
  ]);
  async function send(text, reply, retry) {
    const clientId = retry?.clientId || crypto.randomUUID();
    const optimistic = retry || {
      _id: `pending:${clientId}`,
      clientId,
      conversationId,
      sender: user._id,
      text,
      replyTo: reply || null,
      createdAt: new Date().toISOString(),
      readBy: [user._id],
      deliveredTo: [user._id],
    };
    setMessages((prev) => [
      ...prev.filter((m) => m.clientId !== clientId),
      { ...optimistic, pending: true, failed: false },
    ]);
    try {
      const message = await chat.send({
        conversationId,
        text: optimistic.text,
        clientId,
        replyTo: optimistic.replyTo?._id || null,
      });
      if (alive.current) setMessages((prev) => merge(prev, message));
    } catch (e) {
      if (alive.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === clientId && !/^[a-f\d]{24}$/.test(m._id)
              ? { ...m, pending: false, failed: true }
              : m,
          ),
        );
        setError(e.message);
      }
    }
  }
  async function older() {
    setLoadingOlder(true);
    try {
      const first = messages.find((m) => /^[a-f\d]{24}$/.test(m._id));
      const data = await api(
        `/conversations/${conversationId}/messages?before=${first._id}`,
      );
      if (alive.current) {
        setMessages((prev) => data.messages.reduce(merge, prev));
        setHasMore(data.hasMore);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingOlder(false);
    }
  }
  async function markRead() {
    if (document.visibilityState !== "visible") return;
    const last = [...messages].reverse().find((m) => !m.pending && !m.failed);
    if (!last || last._id === readThrough.current) return;
    readThrough.current = last._id;
    try {
      await api(`/conversations/${conversationId}/read`, {
        method: "POST",
        body: { throughId: last._id },
      });
    } catch (e) {
      readThrough.current = "";
      setError(e.message);
    }
  }
  async function remove(id) {
    try {
      await api(`/messages/${id}`, { method: "DELETE" });
    } catch (e) {
      setError(e.message);
    }
  }
  return {
    messages,
    loading,
    hasMore,
    error,
    setError,
    send,
    older,
    loadingOlder,
    markRead,
    remove,
    load,
  };
}
