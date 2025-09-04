// server/routes/auth.js (Updated)
import jwt from 'jsonwebtoken';
import User from '../models/User.js';


const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  
  // Remove password from output
  user.password = undefined;
  
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// Register
export const Register = async (req, res) => {
  console.log("user to be registered = ", req.body)
  try {
    const { name, email, password, identifier, userType, department, phone } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { matricNumber: identifier }, { adminId: identifier }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email or identifier'
      });
    }
    
    // Create user data object based on user type
    const userData = {
      name,
      email,
      password,
      role: userType || 'student',
      department,
      phone
    };
    
    // Add appropriate identifier field based on user type
    if (userType === 'student') {
      userData.matricNumber = identifier;
    } else {
      userData.adminId = identifier;
    }
    
    // Create new user
    const newUser = await User.create(userData);
    
    createSendToken(newUser, 201, res);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Login
export const Login = async (req, res) => {
  try {
    const { identifier, password, userType } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide identifier and password'
      });
    }
    
    // Build query based on user type
    let query;
    if (userType === 'student') {
      query = { matricNumber: identifier };
    } else {
      query = { 
        $or: [
          { adminId: identifier },
          { email: identifier }
        ]
      };
    }
    
    // Find user and include password field
    const user = await User.findOne(query).select('+password');
    
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect identifier or password'
      });
    }
    
    createSendToken(user, 200, res);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get current user
export const getMe = async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
};