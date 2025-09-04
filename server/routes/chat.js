// routes/chat.js
import express from 'express';
import ChatMessage from '../models/chat.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Get chat messages
router.get('/messages', protect, async (req, res) => {
  try {
    const messages = await ChatMessage.find()
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .then(results => results.reverse());
    
    res.status(200).json({
      status: 'success',
      data: {
        messages
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Create chat message (fallback for when WebSocket is not available)
router.post('/messages', protect, async (req, res) => {
  try {
    const { text } = req.body;
    
    const message = await ChatMessage.create({
      user: req.user.id,
      text
    });
    
    await message.populate('user', 'name');
    
    // Broadcast to all connected clients
    req.app.get('io').to('community-chat').emit('receive-message', {
      _id: message._id,
      user: message.user.name,
      userId: message.user._id,
      text: message.text,
      timestamp: message.createdAt
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        message
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;