// services/user-service/src/server.js
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app  = express();
const PORT = process.env.PORT || 4004;

app.use(cors());
app.use(express.json());

/* ---------- health-check endpoints ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));   // for Docker
app.get('/',       (_req, res) => res.send('User service is running'));

/* ---------- routes ---------- */
// Get user profile by account ID
app.get('/api/v1/users/:accountId', async (req, res) => {
  const { accountId } = req.params;

  try {
    const result = await db.query(
      `SELECT
         name,
         email,
         education_level,
         experience_level,
         preferred_roles,
         description,
         website,
         bio
       FROM devconnect.users
       JOIN devconnect.accounts
         ON devconnect.users.account_id = devconnect.accounts.id
       WHERE devconnect.users.account_id = $1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Error fetching user:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ---------- start server ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`User service running on port ${PORT}`);
});
