// client/src/components/CommunityChat.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import io from "socket.io-client";
import { useAuth } from "../../context/AuthContext";

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
  const messagesContainerRef = useRef(null);

  // gestures / click timing
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

  // Format time as relative (e.g., "5 minutes ago")
  const formatRelativeTime = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
    }

    // For older dates, return the actual date
    return date.toLocaleDateString();
  };

  // -----------------------
  // addOrReplaceMessage helper (dedupe & replace optimistic)
  // -----------------------
  const addOrReplaceMessage = useCallback((incoming) => {
    setMessages((prev) => {
      const incomingId = String(incoming._id);
      // 1) If there's an exact id match, replace it
      const exactIdx = prev.findIndex((m) => String(m._id) === incomingId);
      if (exactIdx > -1) {
        const copy = [...prev];
        copy[exactIdx] = { ...copy[exactIdx], ...incoming };
        return copy;
      }

      // 2) Otherwise, try to find an optimistic temp message to replace:
      const optimisticIdx = prev.findIndex((m) => {
        const idStr = String(m._id || "");
        if (!idStr.startsWith("temp-")) return false;
        if (String(m.userId) !== String(incoming.userId)) return false;
        if ((m.text || "") !== (incoming.text || "")) return false;
        const mReply = m.replyTo ? String(m.replyTo._id || m.replyTo) : null;
        const inReply = incoming.replyTo
          ? String(incoming.replyTo._id || incoming.replyTo)
          : null;
        return mReply === inReply;
      });
      if (optimisticIdx > -1) {
        const copy = [...prev];
        copy[optimisticIdx] = { ...copy[optimisticIdx], ...incoming };
        return copy;
      }

      // 3) No match -> append
      return [...prev, incoming];
    });
  }, []);

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
        addOrReplaceMessage(message);
      });

      s.on("message-reaction-updated", ({ messageId, reactions }) => {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId) ? { ...m, reactions } : m
          )
        );
      });

      s.on("message-updated", (message) => {
        addOrReplaceMessage(message);
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
  }, [addOrReplaceMessage]);

  useEffect(() => {
    connect();
    fetchMessages();
    return () => {
      socketRef.current?.disconnect();
      clearTimeout(longPressTimer.current);
      clearTimeout(clickTimeoutRef.current);
    };
  }, [connect]);

  // Improved scroll behavior
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

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

  // -----------------------
  // sendMessage (optimistic + ack replacement)
  // -----------------------
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

    addOrReplaceMessage(optimisticMsg);

    if (socketRef.current?.connected) {
      socketRef.current.emit("send-message", payload, (ack) => {
        if (ack?.success && ack.message) {
          addOrReplaceMessage(ack.message);
        }
      });
    } else {
      try {
        const res = await api.post("/api/chat/messages", payload);
        const saved = res?.data?.data?.message;
        if (saved) {
          addOrReplaceMessage(saved);
        } else {
          fetchMessages();
        }
      } catch (err) {
        console.error("sendMessage error", err);
        setError("Failed to send message");
      }
    }
  };

  // typing + send on enter
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
        socketRef.current?.emit("react-message", {
          messageId,
          emoji,
          userId: user._id,
        });
        return { ...m, reactions: newReactions };
      })
    );
  };

  // -----------------------
  // Interaction handlers
  // -----------------------
  // Mobile: start touch (start long-press timer for reactions)
  const onTouchStart = (e, m) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = touchStartX.current;
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
    if (delta > 80) {
      setReplyingTo(m); // swipe-right -> reply
    } else {
      // double-tap detection -> open reaction picker
      const now = Date.now();
      const last = lastTapRef.current;
      if (last.id === m._id && now - last.time < 300) {
        setOpenReactionFor(m._id); // double-tap -> reactions
        lastTapRef.current = { id: null, time: 0 };
      } else {
        lastTapRef.current = { id: m._id, time: now };
      }
    }
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  // Desktop click vs double-click:
  const handleClick = (m) => {
    clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      setReplyingTo(m);
    }, 220);
  };

  const handleDoubleClick = (m) => {
    clearTimeout(clickTimeoutRef.current);
    setOpenReactionFor(m._id);
  };

  // right-click opens reaction picker
  const handleContext = (e, m) => {
    e.preventDefault();
    setOpenReactionFor(m._id);
  };

  // Helper to render reactions inside bubble
  const renderReactions = (m) => {
    if (!m.reactions || m.reactions.length === 0) return null;
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

  // -----------------------
  // Render with responsive improvements
  // -----------------------
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 h-full flex flex-col mt-16">
      {" "}
      {/* Added mt-16 for fixed navbar */}
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800/5 bg-gradient-to-br from-white via-slate-50 to-white flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-indigo-500 via-pink-500 to-yellow-400">
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-lg shadow">
              C
            </div>
            <div>
              <h2 className="text-white text-base md:text-lg font-semibold">
                Community Chat
              </h2>
              <p className="text-white/90 text-xs md:text-sm hidden sm:block">
                Connect with your campus community — be kind, be curious.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-white text-sm">
                {messages.length} messages
              </div>
              <OnlineBadge />
            </div>
            <button
              className="px-2 py-1 md:px-3 md:py-1 rounded-lg bg-white/20 text-white text-xs md:text-sm hover:bg-white/30"
              onClick={() => window.location.reload()}
              title="Refresh Chat"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col flex-1">
          {/* Chat column */}
          <div className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
            <div className="flex-1 bg-white rounded-xl shadow-inner p-4 flex flex-col min-h-0">
              {/* messages container */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-scroll max-h-[80vh] space-y-4 p-2 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: "url('/chatbg.jpg')",
                  paddingBottom: 8,
                  WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
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
                    const mine = String(getUserId(m)) === String(user._id);
                    const isSystem = getUserName(m) === "Campus Security"; // Check if system message

                    return (
                      <motion.div
                        key={String(m._id) + "-" + i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: i * 0.01 }}
                        className={`flex items-start ${
                          // Changed from items-end to items-start
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!mine &&
                          !isSystem && ( // Don't show avatar for system messages
                            <div className="flex-shrink-0 mr-2 md:mr-3">
                              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-tr from-pink-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold shadow-lg">
                                {getInitial(m)}
                              </div>
                            </div>
                          )}

                        <div
                          className={`w-full  break-words relative`} // Increased max-width
                          onTouchStart={(e) => onTouchStart(e, m)}
                          onTouchMove={onTouchMove}
                          onTouchEnd={() => onTouchEnd(m)}
                          onClick={() => handleClick(m)}
                          onDoubleClick={() => handleDoubleClick(m)}
                          onContextMenu={(e) => handleContext(e, m)}
                        >
                          <div
                            className={`px-3 py-2 md:px-4 md:py-3 rounded-2xl ${
                              mine
                                ? "rounded-tr-none text-white"
                                : isSystem
                                ? "bg-gray-200 text-gray-800 text-center" // Different style for system messages
                                : "rounded-tl-none text-slate-900"
                            } shadow-md`}
                            style={{
                              background: mine
                                ? "linear-gradient(135deg,#6d28d9,#ec4899)"
                                : isSystem
                                ? "#e5e7eb" // Light gray for system messages
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
                              <div className="flex items-center gap-2 border-b border-gray-300 md:gap-3">
                                {!mine &&
                                  !isSystem && ( // Don't show name for system messages
                                    <div className="text-sm font-semibold  pb-1">
                                      {" "}
                                      {/* Added border bottom */}
                                      {getUserName(m)}
                                    </div>
                                  )}
                                <div
                                  className={`text-xs ${
                                    mine
                                      ? "text-white/90"
                                      : isSystem
                                      ? "text-gray-600"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {formatRelativeTime(
                                    m.updatedAt || m.createdAt || m.timestamp
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2" />
                            </div>

                            <div
                              className={`mt-1 text-sm ${
                                mine
                                  ? "text-white"
                                  : isSystem
                                  ? "text-gray-800 font-medium"
                                  : "text-slate-800"
                              }`}
                            >
                              {m.text}
                            </div>

                            {renderReactions(m)}
                          </div>

                          {/* Reaction picker popover */}
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
                          <div className="flex-shrink-0 ml-2 md:ml-3">
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-tr from-blue-400 to-green-400 flex items-center justify-center text-white font-medium shadow">
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
                    className="flex items-center gap-2 md:gap-3"
                  >
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-gray-100"
                      title="Emoji"
                    >
                      <svg
                        className="w-5 h-5 md:w-6 md:h-6 text-gray-500"
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
                      placeholder="Write a message..."
                      className="flex-1 px-3 py-2 md:px-4 md:py-3 rounded-full bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                    />

                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-full bg-gradient-to-r from-indigo-600 to-pink-500 text-white font-semibold shadow-lg hover:scale-[1.02] transition disabled:opacity-60"
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
                      <span className="text-sm hidden sm:inline">Send</span>
                    </button>
                  </form>

                  {/* small helpers */}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <div className="hidden sm:block">
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
        <div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {error}
        </div>
      )}
    </div>
  );
}
