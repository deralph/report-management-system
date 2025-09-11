// server/index.js (replace your existing file with this or just update the socket handler parts)
// ... keep your existing imports at the top unchanged
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

import authRoutes from "./routes/auth.js";
import reportRoutes from "./routes/report.js";
import userRoutes from "./routes/user.js";
import chatRoutes from "./routes/chat.js";
import ChatMessage from "./models/chat.js"; // updated model path

// protect middleware if you use it for HTTP
import { protect } from "./middlewares/auth.js";

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// make io available to routes
app.set("io", io);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(multer().any());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));
}

app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

app.get("/api/health", (req, res) =>
  res.status(200).json({ message: "Server is running!" })
);

if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/build/index.html"));
  });
}

/* ---------------------
    SOCKET.IO HANDLERS
    --------------------- */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.join("community-chat");

  // typing notifications
  socket.on("typing", ({ userId, isTyping }) => {
    io.to("community-chat").emit("user-typing", { userId, isTyping });
  });

  // send-message (socket)
  socket.on("send-message", async (messageData, callback) => {
    try {
      const { userId, text, replyTo } = messageData;
      if (!userId || !text) {
        if (typeof callback === "function")
          callback({ success: false, message: "Invalid payload" });
        return;
      }

      const message = new ChatMessage({
        user: userId,
        text: text.trim(),
        replyTo: replyTo || null,
      });

      await message.save();

      // CORRECT: await populate directly (Mongoose v6+)
      await message.populate("user", "name");

      // build payload
      const payload = {
        _id: message._id.toString(),
        user: message.user?.name || message.user,
        userId: message.user?._id || message.user,
        text: message.text,
        timestamp: message.createdAt,
        reactions: message.reactions
          ? message.reactions.map((r) => ({ emoji: r.emoji, userId: r.userId }))
          : [],
      };

      if (message.replyTo) {
        const parent = await ChatMessage.findById(message.replyTo).populate(
          "user",
          "name"
        );
        payload.replyTo = parent
          ? {
              _id: parent._id.toString(),
              text: parent.text,
              user: parent.user?.name || parent.user,
              userId: parent.user?._id || parent.user,
            }
          : null;
      }

      // broadcast
      socket.to("community-chat").emit("receive-message", payload);
      socket.emit("receive-message", payload);

      if (typeof callback === "function")
        callback({ success: true, message: payload });
    } catch (err) {
      console.error("Socket send-message error", err);
      socket.emit("error", { message: "Failed to send message" });
      if (typeof callback === "function")
        callback({ success: false, message: "Server error" });
    }
  });

  // react-message (toggle reaction)
  socket.on("react-message", async ({ messageId, emoji, userId }) => {
    try {
      if (!messageId || !emoji || !userId) return;
      const msg = await ChatMessage.findById(messageId);
      if (!msg) return;

      const existsIndex = msg.reactions.findIndex(
        (r) => String(r.userId) === String(userId) && r.emoji === emoji
      );
      if (existsIndex > -1) {
        msg.reactions.splice(existsIndex, 1);
      } else {
        msg.reactions.push({ userId, emoji });
      }

      await msg.save();

      const reactions = msg.reactions.map((r) => ({
        emoji: r.emoji,
        userId: r.userId,
      }));
      io.to("community-chat").emit("message-reaction-updated", {
        messageId: msg._id.toString(),
        reactions,
      });
    } catch (err) {
      console.error("react-message error", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/* error handlers & 404 (unchanged) */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Something went wrong!" });
});
app.use("*", (req, res) =>
  res.status(404).json({ status: "error", message: "Route not found" })
);

/* connect to mongo & start server (unchanged) */
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/aaua-security-system";
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
