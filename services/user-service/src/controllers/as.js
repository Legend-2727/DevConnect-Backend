import db from '../db.js';

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
       WHERE u.account_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { name, educationLevel, experienceLevel, preferredRoles, description, website, bio } = req.body;
  
  try {
    await db.query(
      `UPDATE devconnect.users 
       SET name = $1, education_level = $2, experience_level = $3, 
           preferred_roles = $4, description = $5, website = $6, bio = $7
       WHERE account_id = $8`,
      [name, educationLevel, experienceLevel, preferredRoles, description, website, bio, userId]
    );
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const uploadCV = async (req, res) => {
  const { userId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const filePath = `/files/${req.file.filename}`;
  
  try {
    await db.query(
      `UPDATE devconnect.users SET cv_url = $1 WHERE account_id = $2`,
      [filePath, userId]
    );
    res.status(200).json({ 
      success: true, 
      message: 'CV uploaded successfully', 
      cv_url: filePath 
    });
  } catch (err) {
    console.error('CV upload error:', err);
    res.status(500).json({ error: 'Database error during CV upload' });
  }
};
  
