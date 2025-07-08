import db from '../db.js';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "devconnectsecret";

// Create uploads directory if it doesn't exist
const uploadDir = '/app/uploads/cvs';
console.log('Upload directory path:', uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created uploads directory');
} else {
  console.log('Uploads directory already exists');
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Multer destination called, uploadDir:', uploadDir);
    console.log('File details:', file.originalname);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    console.log('Generated filename:', filename);
    cb(null, filename);
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
    console.log('getUserProfile called');
    console.log('Cookies:', req.cookies);
    
    // Get user ID from JWT token
    const token = req.cookies.token;
    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    console.log('User ID from token:', userId);

    const query = `
      SELECT u.*, a.email 
      FROM devconnect.users u 
      JOIN devconnect.accounts a ON u.account_id = a.id 
      WHERE u.account_id = $1
    `;
    const result = await db.query(query, [userId]);
    console.log('Query result:', result.rows);

    if (result.rows.length === 0) {
      console.log('No profile found');
      return res.json({ profile: null });
    }

    const user = result.rows[0];
    console.log('User data before sending:', user);
    
    // Fix CV URL to be accessible from frontend
    let cvUrl = user.cv_url;
    if (cvUrl && !cvUrl.startsWith('http')) {
      cvUrl = `http://localhost:4004${cvUrl}`;
    }
    
    res.json({ 
      profile: {
        ...user,
        cv_url: cvUrl,
        preferred_roles: Array.isArray(user.preferred_roles) ? user.preferred_roles : []
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
    console.log('Create profile request:', req.body);
    console.log('Uploaded file:', req.file);
    
    // Get user ID from JWT token
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { 
      name, 
      education_level, 
      experience_level, 
      preferred_roles
    } = req.body;
    
    // Handle CV file upload
    let cv_url = null;
    if (req.file) {
      cv_url = `http://localhost:4004/uploads/cvs/${req.file.filename}`;
      console.log('CV uploaded to:', cv_url);
    } else {
      console.log('No file uploaded');
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
    
    // Ensure rolesArray is an array
    if (!Array.isArray(rolesArray)) {
      rolesArray = [];
    }
    
    console.log('Roles array:', rolesArray, 'Type:', typeof rolesArray);

    // Check if profile already exists
    const existingProfile = await db.query(
      'SELECT id FROM devconnect.users WHERE account_id = $1',
      [userId]
    );

    let query, values;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      if (cv_url) {
        query = `
          UPDATE devconnect.users 
          SET name = $1, education_level = $2, experience_level = $3, 
              preferred_roles = $4, cv_url = $5
          WHERE account_id = $6
          RETURNING *
        `;
        values = [name, education_level, experience_level, rolesArray, cv_url, userId];
      } else {
        query = `
          UPDATE devconnect.users 
          SET name = $1, education_level = $2, experience_level = $3, 
              preferred_roles = $4
          WHERE account_id = $5
          RETURNING *
        `;
        values = [name, education_level, experience_level, rolesArray, userId];
      }
    } else {
      // Create new profile
      if (cv_url) {
        query = `
          INSERT INTO devconnect.users 
          (account_id, name, education_level, experience_level, preferred_roles, cv_url)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        values = [userId, name, education_level, experience_level, rolesArray, cv_url];
      } else {
        query = `
          INSERT INTO devconnect.users 
          (account_id, name, education_level, experience_level, preferred_roles)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        values = [userId, name, education_level, experience_level, rolesArray];
      }
    }

    console.log('Executing query:', query);
    console.log('With values:', values);

    const result = await db.query(query, values);
    const profile = result.rows[0];

    console.log('Profile created/updated successfully:', profile);

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

// CV upload handler function (with auth)
export const handleCVUploadAuth = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user ID from JWT token
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const cv_url = `/uploads/cvs/${req.file.filename}`;

    // Update user's CV URL in database
    await db.query(
      'UPDATE devconnect.users SET cv_url = $1 WHERE account_id = $2',
      [cv_url, userId]
    );

    // Return full URL for frontend
    const fullCvUrl = `http://localhost:4004${cv_url}`;

    res.json({ 
      success: true, 
      cv_url: fullCvUrl,
      message: 'CV uploaded successfully' 
    });
  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({ error: 'Failed to upload CV' });
  }
};

// CV upload handler function
export const handleCVUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userId } = req.params;
    const cv_url = `/uploads/cvs/${req.file.filename}`;

    // Update user's CV URL in database
    await db.query(
      'UPDATE devconnect.users SET cv_url = $1 WHERE id = $2',
      [cv_url, userId]
    );

    res.json({ 
      success: true, 
      cv_url: cv_url,
      message: 'CV uploaded successfully' 
    });
  } catch (error) {
    console.error('CV upload error:', error);
    res.status(500).json({ error: 'Failed to upload CV' });
  }
};
