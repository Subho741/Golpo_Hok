import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { api } from "../services/api";
export function useChat(user, setUser) {
  const [conversations, setConversations] = useState([]),
    [loading, setLoading] = useState(true),
    [connection, setConnection] = useState("connecting"),
    [error, setError] = useState(""),
    [typing, setTyping] = useState({});
  const socketRef = useRef(null),
    messageListener = useRef(() => {}),
    receiptListener = useRef(() => {}),
    deleteListener = useRef(() => {});
  const requestSequence = useRef(0);
  const refresh = useCallback(async () => {
    const seq = ++requestSequence.current;
    try {
      const data = await api("/conversations");
      if (seq === requestSequence.current) setConversations(data.conversations);
      return data.conversations;
    } catch (e) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  });
    socketRef.current = socket;
    const deliver = async () => {
      const list = await refresh();
      list.forEach((c) => {
        if (c.lastMessage)
          socket.emit("message:delivered", {
            conversationId: c._id,
            throughId: c.lastMessage._id,
          });
      });
    };
    socket.on("connect", () => {
      setConnection("connected");
      setError("");
      deliver();
      window.dispatchEvent(new Event("chat-reconnected"));
    });
    socket.on("disconnect", (reason) => {
      setConnection("disconnected");
      setTyping({});
      if (reason === "io server disconnect")
        api("/auth/me")
          .then(() => socket.connect())
          .catch(() => window.dispatchEvent(new Event("session-ended")));
    });
    socket.on("connect_error", () => {
      setConnection("disconnected");
    });
    socket.on("message:new", (message) => {
      messageListener.current(message);
      socket.emit("message:delivered", {
        conversationId: message.conversationId,
        throughId: message._id,
      });
      refresh();
    });
    socket.on("conversation:changed", refresh);
    socket.on("message:receipt", (data) => {
      receiptListener.current(data);
    });
    socket.on("message:deleted", (data) => {
      deleteListener.current(data);
      refresh();
    });
    socket.on("presence", (data) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p._id === data.userId
              ? { ...p, online: data.online, lastSeen: data.lastSeen }
              : p,
          ),
        })),
      );
    });
    socket.on("profile:changed", (profile) => {
      if (profile._id === user._id) setUser(profile);
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) =>
            p._id === profile._id ? profile : p,
          ),
        })),
      );
    });
    socket.on("typing", (data) => {
      if (data.userId !== user._id)
        setTyping((prev) => ({
          ...prev,
          [data.conversationId]: data.active ? Date.now() + 3500 : 0,
        }));
    });
    const interval = setInterval(
      () =>
        setTyping((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([, until]) => until > Date.now()),
          ),
        ),
      1000,
    );
    socket.connect();
    refresh();
    const wake = () => {
      if (document.visibilityState === "visible") {
        refresh();
        if (!socket.connected) socket.connect();
      }
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user._id, refresh, setUser]);
  async function send(payload) {
    const socket = socketRef.current;
    if (!socket?.connected)
      throw new Error("You’re offline. Reconnect, then retry this message.");
    const response = await new Promise((resolve, reject) =>
      socket
        .timeout(10000)
        .emit("message:send", payload, (error, data) =>
          error
            ? reject(
                new Error(
                  "Message not confirmed. Tap retry to check and send again.",
                ),
              )
            : resolve(data),
        ),
    );
    if (!response.ok) {
      if (response.status === 401)
        window.dispatchEvent(new Event("session-ended"));
      throw new Error(response.error);
    }
    return response.message;
  }
  return {
    conversations,
    loading,
    connection,
    error,
    setError,
    typing,
    refresh,
    send,
    socketRef,
    messageListener,
    receiptListener,
    deleteListener,
  };
}
