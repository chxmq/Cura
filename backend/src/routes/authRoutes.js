import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res, next) => {
  try {
    const rawName = req.body?.name;
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Server misconfiguration: JWT_SECRET is not set'
      });
    }

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists. Please log in instead.'
      });
    }

    // Create user
    const user = await User.create({ name, email, password });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login user
router.post('/login', async (req, res, next) => {
  try {
    const rawEmail = req.body?.email;
    const rawPassword = req.body?.password;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Server misconfiguration: JWT_SECRET is not set'
      });
    }

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
