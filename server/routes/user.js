// Add to routes/users.js

import  express from 'express';
import  { protect } from '../middlewares/auth.js';
import  { updateProfile } from '../controllers/userController.js';

const router = express.Router();
 

// Update user profile
router.put('/profile/update', protect, updateProfile);

export default router;