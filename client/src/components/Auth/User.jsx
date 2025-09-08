import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import io from "socket.io-client";
import { useAuth } from "../../context/AuthContext";

// Clean, modern Community Chat component
// Improvements in this version:
// - Cleaner modern UI (Instagram/Facebook-inspired): softer shadows, tighter spacing, clearer type scale
// - Reply using double-tap (desktop double-click or mobile double-tap) or swipe-right
// - Long-press (mobile) / right-click (desktop) opens emoji reaction picker
// - Reaction pills are shown inside the bubble and will never overflow off-screen (picker aligns left/right)
// - Optimistic updates kept; server socket interactions unchanged

export default function CommunityChat() {
  const { user, api } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);

  // UI state
  const [replyingTo, setReplyingTo] = useState(null);
  const [openReactionFor, setOpenReactionFor] = useState(null);

  const socketRef = useRef(null);
  const endRef = useRef(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const longPressTimer = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0 });

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

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
          const exists = prev.some((msg) => msg._id === message._id);
          if (!exists) return [...prev, message];
          return prev.map((m) => (m._id === message._id ? message : m));
        });
      });

      s.on("message-reaction-updated", ({ messageId, reactions }) => {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
        );
      });

      s.on("message-updated", (message) => {
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? message : m))
        );
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
    return () => {
      socketRef.current?.disconnect();
      clearTimeout(longPressTimer.current);
    };
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
    if (replyingTo) payload.replyTo = replyingTo._id;
    setNewMessage("");
    setReplyingTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      user: user.name || user.username || "You",
      userId: user._id,
      text: payload.text,
      replyTo: replyingTo
        ? {
            _id: replyingTo._id,
            text: replyingTo.text,
            user: replyingTo.user,
            userId: getUserId(replyingTo),
          }
        : undefined,
      timestamp: new Date().toISOString(),
      reactions: [],
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    if (socketRef.current?.connected) {
      socketRef.current.emit("send-message", payload, (ack) => {
        if (ack?.success && ack.message) {
          setMessages((prev) =>
            prev.map((m) => (m._id === tempId ? ack.message : m))
          );
        }
      });
    } else {
      try {
        const res = await api.post("/api/chat/messages", payload);
        const saved = res?.data?.data?.message;
        if (saved) {
          setMessages((prev) =>
            prev.map((m) => (m._id === tempId ? saved : m))
          );
        } else {
          fetchMessages();
        }
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

  // Reactions (optimistic + emit)
  const reactToMessage = (messageId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== messageId) return m;
        const myReactionIndex = (m.reactions || []).findIndex(
          (r) => String(r.userId) === String(user._id) && r.emoji === emoji
        );
        let newReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
        if (myReactionIndex > -1) {
          newReactions.splice(myReactionIndex, 1);
        } else {
          newReactions.push({ emoji, userId: user._id });
        }
        socketRef.current?.emit("react-message", {
          messageId,
          emoji,
          userId: user._id,
        });
        return { ...m, reactions: newReactions };
      })
    );
  };

  // --- interaction helpers: swipe, double-tap, long-press ---
  const onTouchStart = (e, m) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = touchStartX.current;

    // start long-press timer (open reaction picker)
    longPressTimer.current = setTimeout(() => {
      setOpenReactionFor(m._id);
    }, 520);
  };
  const onTouchMove = (e) => {
    touchCurrentX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (m) => {
    clearTimeout(longPressTimer.current);
    const delta = touchCurrentX.current - touchStartX.current;
    // swipe right to reply
    if (delta > 80) {
      setReplyingTo(m);
    }
    // reset
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  const handleTap = (m) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === m._id && now - last.time < 300) {
      // double-tap detected
      setReplyingTo(m);
      lastTapRef.current = { id: null, time: 0 };
    } else {
      lastTapRef.current = { id: m._id, time: now };
    }
  };

  const handleContext = (e, m) => {
    e.preventDefault();
    setOpenReactionFor(m._id);
  };

  const renderReactions = (m) => {
    if (!m.reactions || m.reactions.length === 0) return null;
    const map = {};
    m.reactions.forEach((r) => (map[r.emoji] = (map[r.emoji] || 0) + 1));

    return (
      <div className="mt-2 flex flex-wrap gap-2 text-xs items-center">
        {Object.keys(map).map((emoji) => (
          <div
            key={emoji}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 shadow text-sm"
          >
            <span className="leading-none">{emoji}</span>
            <span className="text-[11px] text-gray-600">{map[emoji]}</span>
          </div>
        ))}
      </div>
    );
  };

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
    <div className="mx-auto max-w-3xl p-4">
      <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 via-pink-500 to-yellow-400 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              C
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                Community Chat
              </h3>
              <p className="text-xs text-gray-500">
                Tap twice or swipe right to reply • Long-press/right-click to
                react
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-sm text-gray-600">
                {messages.length} messages
              </div>
              <OnlineBadge />
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-indigo-600 hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col">
          <div className="p-4 h-[62vh] overflow-hidden">
            <div className="h-full bg-gray-50 rounded-lg p-4 flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-4 border-gray-200" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400">
                    No messages yet — say hello 👋
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const mine = String(getUserId(m)) === String(user._id);
                    return (
                      <motion.div
                        key={m._id || i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16, delay: i * 0.01 }}
                        className={`flex items-end ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!mine && (
                          <div className="flex-shrink-0 mr-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-pink-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow">
                              {getInitial(m)}
                            </div>
                          </div>
                        )}

                        <div
                          className={`max-w-[78%] break-words relative`}
                          onTouchStart={(e) => onTouchStart(e, m)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={() => onTouchEnd(m)}
                          onClick={() => handleTap(m)}
                          onDoubleClick={() => setReplyingTo(m)}
                          onContextMenu={(e) => handleContext(e, m)}
                        >
                          <div
                            className={`px-4 py-3 rounded-2xl shadow-sm ${
                              mine
                                ? "bg-gradient-to-br from-indigo-600 to-pink-500 text-white"
                                : "bg-white text-gray-800 border"
                            }`}
                            style={{
                              borderColor: mine
                                ? "transparent"
                                : "rgba(229,231,235,0.8)",
                            }}
                          >
                            {m.replyTo && (
                              <div className="mb-2 pl-3 border-l-2 border-indigo-100 text-xs text-gray-500">
                                <div className="truncate max-w-xs">
                                  ↪ {m.replyTo.user}: {m.replyTo.text}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                {!mine && (
                                  <div className="text-sm font-medium">
                                    {getUserName(m)}
                                  </div>
                                )}
                                <div className="text-[11px] text-gray-400">
                                  {formatTime(
                                    m.updatedAt || m.createdAt || m.timestamp
                                  )}
                                </div>
                              </div>

                              {/* small reaction opener for mobile */}
                              <div className="flex items-center gap-1">
                                <button
                                  className="md:hidden text-xs px-2 py-1 rounded bg-white/60"
                                  onClick={() => setOpenReactionFor(m._id)}
                                >
                                  React
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 text-sm leading-snug">
                              {m.text}
                            </div>

                            {/* reaction pills inside the bubble */}
                            <div className="mt-3">{renderReactions(m)}</div>
                          </div>

                          {/* Reaction picker: align to left for received messages, right for mine */}
                          {openReactionFor === m._id && (
                            <div
                              className={`absolute top-0 mt-[-40px] ${
                                mine ? "right-0" : "left-0"
                              } z-50`}
                            >
                              <div className="bg-white rounded-full shadow-md px-3 py-2 flex gap-2">
                                {EMOJIS.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => {
                                      reactToMessage(m._id, e);
                                      setOpenReactionFor(null);
                                    }}
                                    className="text-lg leading-none"
                                  >
                                    {e}
                                  </button>
                                ))}
                                <button
                                  onClick={() => setOpenReactionFor(null)}
                                  className="text-xs px-2"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
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

                {/* typing */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
                    <div>
                      {typingUsers.length > 1
                        ? "Multiple people typing..."
                        : "Someone is typing..."}
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              {/* Input area */}
              <div className="mt-4">
                <div className="p-3 rounded-lg bg-white border border-gray-100 shadow-sm">
                  {replyingTo && (
                    <div className="mb-2 p-2 rounded-md bg-indigo-50 flex items-center justify-between">
                      <div className="text-sm truncate max-w-[60%]">
                        Replying to <strong>{getUserName(replyingTo)}</strong>:{" "}
                        {replyingTo.text}
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="text-xs text-indigo-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex items-center gap-3"
                  >
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Write a message... (Shift+Enter for newline)"
                      className="flex-1 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 text-sm"
                    />

                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm disabled:opacity-50"
                    >
                      Send
                    </button>
                  </form>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <div>Double-tap to reply • Long-press to react</div>
                    <div>{newMessage.length}/500</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed right-6 bottom-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
