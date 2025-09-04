// server/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  matricNumber: {
    type: String,
    sparse: true // Allows null values while maintaining uniqueness for non-null values
  },
  adminId: {
    type: String,
    sparse: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['student', 'admin', 'security', 'medical', 'special'],
    default: 'student'
  },
  department: {
    type: String
  },
  phone: {
    type: String
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};
export default mongoose.model('User', userSchema);