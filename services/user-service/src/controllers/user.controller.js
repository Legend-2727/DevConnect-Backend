import db from '../db/index.js';

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
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUser = async (req, res) => {
  const { userId } = req.params;
  const result = await db.query(`SELECT * FROM devconnect.users WHERE id = $1`, [userId]);
  res.json(result.rows[0]);
};

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { name, preferredRoles } = req.body;
  await db.query(
    `UPDATE devconnect.users SET name = $1, preferred_roles = $2 WHERE id = $3`,
    [name, preferredRoles, userId]
  );
  res.json({ message: 'Profile updated' });
};

export const uploadCV = async (req, res) => {
    const { userId } = req.params;
    const filePath = `/files/${req.file.filename}`;  // This is public URL path
  
    try {
      await db.query(
        `UPDATE devconnect.users SET cv_url = $1 WHERE id = $2`,
        [filePath, userId]
      );
      res.status(200).json({ message: 'CV uploaded successfully', cv_url: filePath });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error during CV upload' });
    }
  };

export const getUserProfile = async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(`
      SELECT u.*, a.email 
      FROM devconnect.users u 
      JOIN devconnect.accounts a ON u.account_id = a.id 
      WHERE u.id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        education: user.education_level,
        experience: user.experience_level,
        skills: user.preferred_roles || [],
        website: user.website,
        description: user.description,
        cv_url: user.cv_url
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};

export const getUserStats = async (req, res) => {
  const { userId } = req.params;
  try {
    // Get active applications count
    const applicationsResult = await db.query(
      `SELECT COUNT(*) as count FROM devconnect.applications WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );
    
    // For now, set profile views and recommendations to 0
    // These would need to be implemented in their respective services
    const stats = {
      activeApplications: parseInt(applicationsResult.rows[0].count) || 0,
      profileViews: 0,
      recommendations: 0
    };
    
    res.json({ success: true, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
};
  
