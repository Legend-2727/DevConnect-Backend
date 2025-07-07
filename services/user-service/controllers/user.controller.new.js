import db from '../db.js';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || "devconnectsecret";

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads/cvs/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC files are allowed!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    // Get user ID from JWT token
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const query = `
      SELECT u.*, a.email 
      FROM devconnect.users u 
      JOIN devconnect.accounts a ON u.account_id = a.id 
      WHERE u.account_id = $1
    `;
    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.json({ profile: null });
    }

    const user = result.rows[0];
    res.json({ 
      profile: {
        ...user,
        preferred_roles: typeof user.preferred_roles === 'string' ? JSON.parse(user.preferred_roles) : user.preferred_roles
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create/Update user profile
export const createUserProfile = async (req, res) => {
  try {
    // Get user ID from JWT token
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { name, education_level, experience_level, preferred_roles, description, website, bio } = req.body;
    
    // Handle CV file upload
    let cv_url = null;
    if (req.file) {
      cv_url = `/uploads/cvs/${req.file.filename}`;
    }

    // Parse preferred_roles if it's a string
    let rolesArray = preferred_roles;
    if (typeof preferred_roles === 'string') {
      try {
        rolesArray = JSON.parse(preferred_roles);
      } catch (e) {
        rolesArray = [];
      }
    }

    // Check if profile already exists
    const existingProfile = await db.query(
      'SELECT id FROM devconnect.users WHERE account_id = $1',
      [userId]
    );

    let query, values;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      query = `
        UPDATE devconnect.users 
        SET name = $1, education_level = $2, experience_level = $3, 
            preferred_roles = $4, description = $5, website = $6, bio = $7
            ${cv_url ? ', cv_url = $8' : ''}
        WHERE account_id = ${cv_url ? '$9' : '$8'}
        RETURNING *
      `;
      values = cv_url 
        ? [name, education_level, experience_level, JSON.stringify(rolesArray), description, website, bio, cv_url, userId]
        : [name, education_level, experience_level, JSON.stringify(rolesArray), description, website, bio, userId];
    } else {
      // Create new profile
      query = `
        INSERT INTO devconnect.users 
        (account_id, name, education_level, experience_level, preferred_roles, description, website, bio${cv_url ? ', cv_url' : ''})
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8${cv_url ? ', $9' : ''})
        RETURNING *
      `;
      values = cv_url 
        ? [userId, name, education_level, experience_level, JSON.stringify(rolesArray), description, website, bio, cv_url]
        : [userId, name, education_level, experience_level, JSON.stringify(rolesArray), description, website, bio];
    }

    const result = await db.query(query, values);
    const profile = result.rows[0];

    // Get user email
    const emailQuery = 'SELECT email FROM devconnect.accounts WHERE id = $1';
    const emailResult = await db.query(emailQuery, [userId]);
    
    res.json({
      success: true,
      profile: {
        ...profile,
        email: emailResult.rows[0]?.email,
        preferred_roles: typeof profile.preferred_roles === 'string' ? JSON.parse(profile.preferred_roles) : profile.preferred_roles
      }
    });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Legacy functions for compatibility
export const getSignupMetadata = (req, res) => {
  res.json({
    educationLevels: ["Undergraduate", "Graduate", "Postgraduate"],
    experienceLevels: ["Fresher", "1-3 years", "3+ years"],
    preferredRoles: ["BackendDeveloper", "Data Analyst", "Product Manager"]
  });
};

export const createUser = async (req, res) => {
  const { name, email, accountId } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO devconnect.users (account_id, name, email) VALUES ($1, $2, $3) RETURNING id`,
      [accountId, name, email]
    );
    res.status(201).json({ userId: result.rows[0].id });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT u.*, a.email 
       FROM devconnect.users u 
       JOIN devconnect.accounts a ON u.account_id = a.id 
       WHERE u.id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Middleware for handling file upload
export const uploadCV = upload.single('cv');
