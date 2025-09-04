import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/report.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';

// Import middleware
import { protect } from './middlewares/auth.js';

// Import models
import ChatMessage from './models/chat.js';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(multer().any()); // For handling file uploads

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Routes
app.use('/api/auth', authRoutes);
console.log('Mounting report routes');

app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running!' });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}
// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room for general chat
  socket.join('community-chat');

  // Handle new messages
  socket.on('send-message', async (messageData) => {
    try {
      // Save message to database
      const message = new ChatMessage({
        user: messageData.userId,
        text: messageData.text
      });
      
      await message.save();
      await message.populate('user', 'name');
      
      // Broadcast the message to all users in the community chat room EXCEPT the sender
      socket.to('community-chat').emit('receive-message', {
        _id: message._id,
        user: message.user.name,
        userId: message.user._id,
        text: message.text,
        timestamp: message.createdAt
      });
      
      // Send the message back only to the sender with the correct data
      socket.emit('receive-message', {
        _id: message._id,
        user: message.user.name,
        userId: message.user._id,
        text: message.text,
        timestamp: message.createdAt
      });
    } catch (error) {
      console.error('Error saving chat message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: 'error', 
    message: 'Something went wrong!' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    status: 'error', 
    message: 'Route not found' 
  });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aaua-security-system';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});