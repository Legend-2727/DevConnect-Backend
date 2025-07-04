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
      `INSERT INTO user_service.users (account_id, name, email) VALUES ($1, $2, $3) RETURNING id`,
      [accountId, name, email]
    );
    res.status(201).json({ userId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const getUser = async (req, res) => {
  const { userId } = req.params;
  const result = await db.query(`SELECT * FROM user_service.users WHERE id = $1`, [userId]);
  res.json(result.rows[0]);
};

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { name, preferredRoles } = req.body;
  await db.query(
    `UPDATE user_service.users SET name = $1, preferred_roles = $2 WHERE id = $3`,
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
  
