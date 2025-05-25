import db from '../db/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devconnectsecret';



export const registerAccount = async (req, res) => {
  const { accountType, email, password } = req.body;

  if (!accountType || !email || !password) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    
    const existing = await db.query(
      'SELECT * FROM auth_service.accounts WHERE email = $1 AND account_type = $2',
      [email, accountType]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Account already exists' });
    }

    
    const hashedPassword = await bcrypt.hash(password, 10);

    
    const result = await db.query(
      `INSERT INTO auth_service.accounts (email, password_hash, account_type)
       VALUES ($1, $2, $3) RETURNING id`,
      [email, hashedPassword, accountType]
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accountId: result.rows[0].id
    });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};


export const loginOptions = (req, res) => {
  res.json({ accountTypes: ['User', 'Company'] });
};

export const validateLogin = async (req, res) => {
  const { accountType, id, password } = req.body;

  if (!accountType || !id || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM auth_service.accounts WHERE id = $1 AND account_type = $2',
      [id, accountType]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid ID or password' });
    }

    const account = result.rows[0];

    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid ID or password' });
    }

    const token = jwt.sign(
      { id: account.id, type: account.account_type },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      success: true,
      redirectURL: account.account_type === 'User' ? 'user/dashboard' : 'company/dashboard'
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};


export const logoutUser = (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Successfully logged out' });
};


export const getLoggedInUser = async (req, res) => {
  try {
    const { id, type } = req.user; 
    const result = await db.query(
      'SELECT id, account_type FROM auth_service.accounts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Fetch user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};



