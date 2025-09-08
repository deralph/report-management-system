// backend/routes/chat.js
import express from "express";
import ChatMessage from "../models/chat.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

/**
 * Helper to format a ChatMessage mongoose doc into the client payload shape
 */
const formatMessagePayload = (msgDoc) => {
  const replyTo = msgDoc.replyTo
    ? {
        _id: msgDoc.replyTo._id,
        text: msgDoc.replyTo.text,
        user: msgDoc.replyTo.user?.name || msgDoc.replyTo.user || "Unknown",
        userId: msgDoc.replyTo.user?._id || msgDoc.replyTo.user,
      }
    : null;

  const reactions = Array.isArray(msgDoc.reactions)
    ? msgDoc.reactions.map((r) => ({ emoji: r.emoji, userId: r.userId }))
    : [];

  return {
    _id: msgDoc._id,
    user: msgDoc.user?.name || msgDoc.user || "Unknown",
    userId: msgDoc.user?._id || msgDoc.user,
    text: msgDoc.text,
    timestamp: msgDoc.createdAt,
    replyTo,
    reactions,
  };
};

// GET /api/chat/messages
router.get("/messages", protect, async (req, res) => {
  try {
    const messages = await ChatMessage.find()
      .populate("user", "name")
      .populate({ path: "replyTo", populate: { path: "user", select: "name" } })
      .sort({ createdAt: -1 })
      .limit(50)
      .then((results) => results.reverse()); // oldest -> newest

    const payload = messages.map(formatMessagePayload);

    return res.status(200).json({
      status: "success",
      data: {
        messages: payload,
      },
    });
  } catch (error) {
    console.error("GET /api/chat/messages error", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

// POST /api/chat/messages
// Accepts { text, replyTo? }
router.post("/messages", protect, async (req, res) => {
  try {
    const { text, replyTo } = req.body;
    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ status: "error", message: "Text is required" });
    }

    const message = await ChatMessage.create({
      user: req.user.id,
      text: text.trim(),
      replyTo: replyTo || null,
    });

    // populate user and replyTo.user
    await message.populate("user", "name");
    if (message.replyTo) {
      await message.populate({
        path: "replyTo",
        populate: { path: "user", select: "name" },
      });
    }

    const payload = formatMessagePayload(message);

    // Emit to socket room (server sets io on app)
    const io = req.app.get("io");
    if (io) {
      io.to("community-chat").emit("receive-message", payload);
    }

    return res.status(201).json({
      status: "success",
      data: {
        message: payload,
      },
    });
  } catch (error) {
    console.error("POST /api/chat/messages error", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
