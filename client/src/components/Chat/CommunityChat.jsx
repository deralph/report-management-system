import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import io from "socket.io-client";
import { useAuth } from "../../context/AuthContext";

// A polished, modern Community Chat component using Tailwind + Framer Motion.
// - Removed trending/incidents sidebar per request.
// - Focused on an Instagram/Facebook-like aesthetic: gradients, soft shadows, rounded bubbles, avatars, and a luxe input bar.
// - Export default component ready to drop into your project. You may tweak colors or animations.

export default function CommunityChat() {
  const { user, api } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);

  const socketRef = useRef(null);
  const endRef = useRef(null);

  const getUserName = (m) => {
    if (!m) return "Unknown";
    if (typeof m.user === "string") return m.user;
    if (m.user && typeof m.user === "object")
      return m.user.name || m.user.username || "Unknown";
    return "Unknown";
  };
  const getUserId = (m) => {
    if (!m) return null;
    if (m.userId) return m.userId;
    if (m.user && typeof m.user === "object") return m.user._id || m.user.id;
    return null;
  };
  const getInitial = (m) => {
    const name = getUserName(m);
    return name ? name.charAt(0).toUpperCase() : "U";
  };

  // --- Websocket connect ---
  const connect = useCallback(() => {
    try {
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
      if (socketRef.current) socketRef.current.disconnect();
      const s = io(backendUrl, { transports: ["websocket", "polling"] });
      socketRef.current = s;

      s.on("connect", () => {
        setSocketConnected(true);
        setError("");
      });

      s.on("receive-message", (message) => {
        setMessages((prev) => {
          const exists = prev.some(
            (msg) =>
              msg._id === message._id ||
              (msg.text === message.text &&
                getUserId(msg) === getUserId(message) &&
                msg.timestamp === message.timestamp)
          );
          if (!exists) return [...prev, message];
          return prev;
        });
      });

      s.on("user-typing", ({ userId, isTyping }) => {
        setTypingUsers((prev) => {
          if (isTyping) {
            if (!prev.includes(userId)) return [...prev, userId];
            return prev;
          } else {
            return prev.filter((id) => id !== userId);
          }
        });
      });

      s.on("disconnect", () => setSocketConnected(false));
      s.on("error", (err) => {
        console.error(err);
        setError("Socket error");
      });
    } catch (err) {
      console.error("Socket init error", err);
      setError("Failed to connect to chat server");
    }
  }, []);

  useEffect(() => {
    connect();
    fetchMessages();
    return () => socketRef.current?.disconnect();
  }, [connect]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await api.get("/api/chat/messages");
      const msgs = res?.data?.data?.messages || [];
      setMessages(msgs);
    } catch (err) {
      console.error(err);
      setError("Could not load messages");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const payload = { userId: user._id, text: newMessage.trim() };
    setNewMessage("");

    if (socketRef.current?.connected) {
      socketRef.current.emit("send-message", payload);
    } else {
      try {
        await api.post("/api/chat/messages", { text: payload.text });
        fetchMessages();
      } catch (err) {
        setError("Failed to send message");
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // notify typing
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing", { userId: user._id, isTyping: true });
      clearTimeout(window.__typingTimeout);
      window.__typingTimeout = setTimeout(() => {
        socketRef.current.emit("typing", { userId: user._id, isTyping: false });
      }, 700);
    }
  };

  const formatTime = (ts) => {
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // --- Small UI pieces ---
  const OnlineBadge = () => (
    <div className="flex items-center space-x-2">
      <div
        className={`h-3 w-3 rounded-full ${
          socketConnected ? "bg-green-400" : "bg-gray-400"
        } shadow-sm`}
      />
      <span className="text-xs text-gray-300">
        {socketConnected ? "Live" : "Offline"}
      </span>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800/5 bg-gradient-to-br from-white via-slate-50 to-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-lg shadow">
              C
            </div>
            <div>
              <h2 className="text-white text-lg font-semibold">
                Community Chat
              </h2>
              <p className="text-white/90 text-sm">
                Connect with your campus community — be kind, be curious.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-white text-sm">
                {messages.length} messages
              </div>
              <OnlineBadge />
            </div>
            <button
              className="px-3 py-1 rounded-lg bg-white/20 text-white text-sm hover:bg-white/30"
              onClick={() => window.location.reload()}
              title="Refresh Chat"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row">
          {/* Chat column */}
          <div className="flex-1 p-6 min-h-[60vh] max-h-[70vh] overflow-hidden">
            <div className="h-full bg-white rounded-xl shadow-inner p-4 flex flex-col">
              {/* messages container */}
              <div
                className="flex-1 overflow-y-auto space-y-4 pr-2"
                style={{ paddingBottom: 8 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-4 border-gray-200"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400">
                    No messages yet — say hello 👋
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const mine = getUserId(m) === user._id;
                    return (
                      <motion.div
                        key={m._id || i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.02 }}
                        className={`flex items-end ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!mine && (
                          <div className="flex-shrink-0 mr-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-pink-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow-lg">
                              {getInitial(m)}
                            </div>
                          </div>
                        )}

                        <div className={`max-w-[78%] break-words`}>
                          <div
                            className={`px-4 py-3 rounded-2xl ${
                              mine
                                ? "rounded-br-none text-white"
                                : "rounded-bl-none text-slate-900"
                            } shadow-md`}
                            style={{
                              background: mine
                                ? "linear-gradient(135deg,#6d28d9,#ec4899)"
                                : "#f8fafc",
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                {!mine && (
                                  <div className="text-sm font-semibold">
                                    {getUserName(m)}
                                  </div>
                                )}
                                <div
                                  className={`text-xs ${
                                    mine ? "text-white/90" : "text-gray-500"
                                  }`}
                                >
                                  {formatTime(
                                    m.updatedAt || m.createdAt || m.timestamp
                                  )}
                                </div>
                              </div>
                            </div>

                            <div
                              className={`mt-1 text-sm ${
                                mine ? "text-white" : "text-slate-800"
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        </div>

                        {mine && (
                          <div className="flex-shrink-0 ml-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-400 to-green-400 flex items-center justify-center text-white font-medium shadow">
                              {getInitial(m)}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}

                {/* typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
                    <div>
                      {typingUsers.length > 1
                        ? "Multiple people are typing..."
                        : "Someone is typing..."}
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              {/* input area */}
              <div className="mt-4">
                <div className="bg-gradient-to-r from-white to-white p-3 rounded-xl shadow-md">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-center gap-3"
                  >
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-gray-100"
                      title="Emoji"
                    >
                      <svg
                        className="w-6 h-6 text-gray-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M14.5 11.5c.828 0 1.5-.672 1.5-1.5S15.328 8.5 14.5 8.5 13 9.172 13 10s.672 1.5 1.5 1.5zM9.5 11.5c.828 0 1.5-.672 1.5-1.5S10.328 8.5 9.5 8.5 8 9.172 8 10s.672 1.5 1.5 1.5z"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Write a message... (Shift+Enter for newline)"
                      className="flex-1 px-4 py-3 rounded-full bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                    />

                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-pink-500 text-white font-semibold shadow-lg hover:scale-[1.02] transition disabled:opacity-60"
                    >
                      <svg
                        className="w-4 h-4 -rotate-45"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M22 2L11 13"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M22 2l-7 20 1-7 7-7-7-6z"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-sm">Send</span>
                    </button>
                  </form>

                  {/* small helpers */}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <div>
                      Press{" "}
                      <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                        Enter
                      </kbd>{" "}
                      to send
                    </div>
                    <div>{newMessage.length}/500</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* (Optional) Right-side area for participants or info - kept minimal */}
          <div className="hidden md:block w-64 p-6">
            <div className="bg-white rounded-xl p-4 shadow">
              <h3 className="text-sm font-semibold mb-2">Participants</h3>
              <div className="text-xs text-gray-500 mb-4">
                Active members in this chat.
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 via-indigo-500 to-purple-500 text-white flex items-center justify-center">
                    A
                  </div>
                  <div className="flex-1 text-sm">Alice</div>
                  <div className="text-xs text-green-400">●</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-300 text-white flex items-center justify-center">
                    B
                  </div>
                  <div className="flex-1 text-sm">Bayo</div>
                  <div className="text-xs text-green-400">●</div>
                </div>
                <div className="flex items-center gap-3 opacity-60">
                  <div className="h-8 w-8 rounded-full bg-gray-200 text-white flex items-center justify-center">
                    C
                  </div>
                  <div className="flex-1 text-sm">Charles</div>
                  <div className="text-xs text-gray-300">○</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed right-6 bottom-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
