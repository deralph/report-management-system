// Add to routes/users.js

import User from '../models/User.js';

// Update user profile
export const updateProfile =  async (req, res) => {
  try {
    const { name, phone, department } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      { name, phone, department },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};