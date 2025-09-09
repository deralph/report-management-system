// client/src/components/CommunityChat.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import io from "socket.io-client";
import { useAuth } from "../../context/AuthContext";

// CommunityChat with swipe-to-reply and message reactions (interaction updates only)
// UI retained exactly as you provided; only interaction logic changed:
// - removed reply arrow icons
// - desktop: left-click = reply, double-click = quick 👍 react, right-click = open reactions
// - mobile: swipe right = reply, double-tap = reply, long-press = open reactions

export default function CommunityChat() {
  const { user, api } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);

  // UI state
  const [replyingTo, setReplyingTo] = useState(null); // message object
  const [openReactionFor, setOpenReactionFor] = useState(null); // message id which has the emoji picker open

  const socketRef = useRef(null);
  const endRef = useRef(null);

  // gesture state
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const longPressTimer = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0 });
  const clickTimeoutRef = useRef(null);

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
          const exists = prev.some(
            (msg) => String(msg._id) === String(message._id)
          );
          if (!exists) return [...prev, message];
          return prev.map((m) =>
            String(m._id) === String(message._id) ? message : m
          );
        });
      });

      // Updates to reactions
      s.on("message-reaction-updated", ({ messageId, reactions }) => {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId) ? { ...m, reactions } : m
          )
        );
      });

      s.on("message-updated", (message) => {
        setMessages((prev) =>
          prev.map((m) => (String(m._id) === String(message._id) ? message : m))
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
      clearTimeout(clickTimeoutRef.current);
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

    // optimistic: create a temporary id & add to UI
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

  // Reactions (optimistic toggle + emit)
  const reactToMessage = (messageId, emoji) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (String(m._id) !== String(messageId)) return m;
        const myReactionIndex = (m.reactions || []).findIndex(
          (r) => String(r.userId) === String(user._id) && r.emoji === emoji
        );
        let newReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
        if (myReactionIndex > -1) {
          newReactions.splice(myReactionIndex, 1);
        } else {
          newReactions.push({ emoji, userId: user._id });
        }
        // emit to server to persist and broadcast
        socketRef.current?.emit("react-message", {
          messageId,
          emoji,
          userId: user._id,
        });
        return { ...m, reactions: newReactions };
      })
    );
  };

  // --- Interaction handlers: click/double-click (desktop), double-tap/swipe/long-press (mobile) ---

  // Start touch: set start X and start long-press timer (open reactions)
  const onTouchStart = (e, m) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = touchStartX.current;

    // long-press opens reaction picker
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
    // swipe right beyond threshold -> reply
    if (delta > 80) {
      setReplyingTo(m);
    } else {
      // detect double-tap for reply (mobile)
      const now = Date.now();
      const last = lastTapRef.current;
      if (last.id === m._id && now - last.time < 300) {
        // double-tap -> reply
        setReplyingTo(m);
        lastTapRef.current = { id: null, time: 0 };
      } else {
        lastTapRef.current = { id: m._id, time: now };
      }
    }
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  // Desktop: handle click vs double-click distinction for reply vs quick-react
  const handleClick = (m) => {
    // schedule single-click (reply) after short delay; if double-click occurs earlier, cancel it
    clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setReplyingTo(m);
    }, 220);
  };

  const handleDoubleClick = (m) => {
    // double-click -> quick toggle a default reaction (thumbs up)
    clearTimeout(clickTimeoutRef.current);
    reactToMessage(m._id, "👍");
  };

  // Right-click opens reaction picker (desktop)
  const handleContext = (e, m) => {
    e.preventDefault();
    setOpenReactionFor(m._id);
  };

  // Helper to render reaction summary
  const renderReactions = (m) => {
    if (!m.reactions || m.reactions.length === 0) return null;
    // reduce to emoji => count
    const map = {};
    m.reactions.forEach((r) => (map[r.emoji] = (map[r.emoji] || 0) + 1));
    return (
      <div className="mt-2 inline-flex items-center gap-2 text-xs">
        {Object.keys(map).map((emoji) => (
          <div
            key={emoji}
            className="px-2 py-1 rounded-full bg-gray-100 text-sm"
          >
            {emoji} {map[emoji]}
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
        <div className="flex flex-col md:flex-row ">
          {/* Chat column */}
          <div className="flex-1 p-6 ">
            <div className="h-full bg-white rounded-xl shadow-inner p-4 flex flex-col">
              {/* messages container */}
              <div className="overflow-y-scroll min-h-[60vh] max-h-[70vh] flex-1">
                <div
                  className="flex-1 overflow-y-auto space-y-4 pr-2 bg-cover bg-center bg-no-repeat "
                  style={{
                    backgroundImage: "url('/chatbg.jpg')",
                    paddingBottom: 8,
                  }}
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
                          key={String(m._id) + "-" + i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, delay: i * 0.01 }}
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

                          <div
                            className={`max-w-[78%] break-words relative`}
                            onTouchStart={(e) => onTouchStart(e, m)}
                            onTouchMove={onTouchMove}
                            onTouchEnd={() => onTouchEnd(m)}
                            onClick={() => handleClick(m)}
                            onDoubleClick={() => handleDoubleClick(m)}
                            onContextMenu={(e) => handleContext(e, m)}
                          >
                            {/* NOTE: removed the left reply/react icons here (per request) */}

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
                              {/* reply preview */}
                              {m.replyTo && (
                                <div className="mb-2 p-2 rounded-md bg-white/60 text-xs text-gray-600 border-l-2 border-indigo-200">
                                  <div className="font-semibold text-xs">
                                    Replying to{" "}
                                    {m.replyTo.user ||
                                      m.replyTo.user?.name ||
                                      "Unknown"}
                                  </div>
                                  <div className="truncate max-w-xs">
                                    {m.replyTo.text}
                                  </div>
                                </div>
                              )}

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
                                <div className="flex items-center gap-2">
                                  {/* small reaction opener for mobile removed to rely on long-press */}
                                </div>
                              </div>

                              <div
                                className={`mt-1 text-sm ${
                                  mine ? "text-white" : "text-slate-800"
                                }`}
                              >
                                {m.text}
                              </div>

                              {renderReactions(m)}
                            </div>

                            {/* Reaction picker popover (opens via long-press or right-click or when openReactionFor === id) */}
                            {openReactionFor === m._id && (
                              <div className="absolute right-0 top-0 mt-2 bg-white rounded-lg shadow p-2 flex gap-2 z-50">
                                {EMOJIS.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => {
                                      reactToMessage(m._id, e);
                                      setOpenReactionFor(null);
                                    }}
                                    className="p-1 text-lg"
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
              </div>

              {/* input area */}
              <div className="mt-4">
                <div className="bg-gradient-to-r from-white to-white p-3 rounded-xl shadow-md">
                  {/* Replying preview */}
                  {replyingTo && (
                    <div className="mb-2 p-2 rounded-md bg-indigo-50 flex items-center justify-between">
                      <div className="text-sm">
                        Replying to <strong>{getUserName(replyingTo)}</strong>:{" "}
                        <span className="truncate max-w-xs">
                          {replyingTo.text}
                        </span>
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
