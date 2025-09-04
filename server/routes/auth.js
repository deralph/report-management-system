// server/routes/auth.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import { Register,Login,getMe } from '../controllers/authController.js';

const router = express.Router();


// Register
router.post('/register', Register);

// Login
router.post('/login', Login);

// Get current user
router.get('/me', protect, getMe);

export default router;