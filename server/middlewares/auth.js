// server/middleware/auth.js
import  jwt from 'jsonwebtoken';
import  User from '../models/User.js';

export const protect = async (req, res, next) => {
  // console.log("in protect middle ware ")
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log("NO token found ")
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized to access this route'
      });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log("NO user found ")
        return res.status(401).json({
          status: 'error',
          message: 'Not authorized, user not found'
        });
      }
      console.log("all protect done successfully ")

      next();
    } catch (error) {
      console.log('Token verification error:', error);
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized, token failed'
      });
    }
  } catch (error) {
    console.log('Auth middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
};

// Optional: Admin authorization middleware
export const authorize = (...roles) => {
  console.log('In authorize middleware ');
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log(`User role ${req.user.role} is not authorized to access this route`);
      return res.status(403).json({
        status: 'error',
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};
