// services/auth-service/src/controllers/auth.controller.js
import db      from "../db/index.js";
import bcrypt  from "bcrypt";
import jwt     from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "devconnectsecret";

/* ──────────────────────────────────────────────────────────
   Register  ➜  /api/v1/auth/register
   • Prevent duplicate accounts
   • Insert into devconnect.accounts
   • Immediately stub a blank profile row (users | companies)
   • All inside a single SQL transaction
─────────────────────────────────────────────────────────── */
export const registerAccount = async (req, res) => {
  const { accountType, email, password } = req.body;

  if (!accountType || !email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  let client;
  try {
    client = await db.connect();
    await client.query("BEGIN");

    /* 1️⃣  Block duplicates */
    const dup = await client.query(
      `SELECT 1
         FROM devconnect.accounts
        WHERE email = $1
          AND account_type = $2`,
      [email, accountType]
    );
    if (dup.rows.length) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ success: false, error: "Account already exists" });
    }

    /* 2️⃣  Insert into devconnect.accounts */
    const hashed = await bcrypt.hash(password, 10);
    const accRes = await client.query(
      `INSERT INTO devconnect.accounts (email, password_hash, account_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email, hashed, accountType]
    );
    const accountId = accRes.rows[0].id;

    // Note: Profile creation will happen later in separate endpoints
    // - Users will create profiles via user-service
    // - Companies will create profiles via company-service

    await client.query("COMMIT");

    // Auto-login after successful signup
    const token = jwt.sign(
      { id: accountId, type: accountType },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    console.log('🔑 Setting token for new account ID:', accountId);
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Determine redirect URL based on account type (same logic as login)
    let redirectURL;
    if (accountType === "User") {
      // New user accounts won't have profiles, so redirect to profile creation
      redirectURL = "/user/profile";
    } else {
      // New company accounts won't have profiles, so redirect to profile creation
      redirectURL = "/company/profile";
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      accountId,
      role: accountType,
      redirectURL: redirectURL,
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Register error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  } finally {
    if (client) client.release();
  }
};

/* ──────────────────────────────────────────────────────────
   Misc. endpoints (unchanged)
─────────────────────────────────────────────────────────── */
export const loginOptions = (req, res) => {
  res.json({ accountTypes: ["User", "Company"] });
};

export const validateLogin = async (req, res) => {
  console.log('🔍 Login request received:', req.body);
  const { accountType, id, email, password } = req.body;

  if (!accountType || (!id && !email) || !password) {
    console.log('❌ Missing credentials:', { accountType, id, email, password: !!password });
    return res
      .status(400)
      .json({ success: false, error: "Missing credentials" });
  }

  try {
    // 1. fetch account
    const query =
      id
        ? "SELECT * FROM devconnect.accounts WHERE id = $1 AND account_type = $2"
        : "SELECT * FROM devconnect.accounts WHERE email = $1 AND account_type = $2";
    const values = id ? [parseInt(id, 10), accountType] : [email, accountType];
    console.log('🔍 Database query:', query, values);
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      console.log('❌ No account found for:', { email, accountType });
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    const account = result.rows[0];
    console.log('✅ Account found:', { id: account.id, email: account.email, type: account.account_type });

    // 2. verify password
    const match = await bcrypt.compare(password, account.password_hash);
    console.log('🔍 Password match:', match);
    if (!match) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // 3. Clear any existing token first, then set new one
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      path: '/',
      domain: undefined
    });
    
    const token = jwt.sign(
      { id: account.id, type: account.account_type },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    console.log('🔑 Setting new token for account ID:', account.id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 4. Determine redirect URL based on account type and profile existence
    let redirectURL;
    if (account.account_type === "User") {
      // For users, check if profile exists
      try {
        const profileCheck = await db.query(
          'SELECT id FROM devconnect.users WHERE account_id = $1',
          [account.id]
        );
        
        if (profileCheck.rows.length > 0) {
          console.log('✅ User profile exists, redirecting to dashboard');
          redirectURL = "/user/dashboard";
        } else {
          console.log('🆕 No user profile found, redirecting to profile creation');
          redirectURL = "/user/profile";
        }
      } catch (profileError) {
        console.error('Error checking user profile:', profileError);
        // Default to profile creation if check fails
        redirectURL = "/user/profile";
      }
    } else {
      // For companies, check if profile exists
      try {
        const profileCheck = await db.query(
          'SELECT id FROM devconnect.companies WHERE account_id = $1',
          [account.id]
        );
        
        if (profileCheck.rows.length > 0) {
          console.log('✅ Company profile exists, redirecting to dashboard');
          redirectURL = "/company/dashboard";
        } else {
          console.log('🆕 No company profile found, redirecting to profile creation');
          redirectURL = "/company/profile";
        }
      } catch (profileError) {
        console.error('Error checking company profile:', profileError);
        // Default to profile creation if check fails
        redirectURL = "/company/profile";
      }
    }
    
    console.log('✅ Login successful, redirecting to:', redirectURL);
    return res.status(200).json({
      success: true,
      id: account.id,
      email: account.email,
      role: account.account_type,
      redirectURL: redirectURL,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const logoutUser = (req, res) => {
  console.log('🚪 Logout request received');
  console.log('🍪 Cookies before clearing:', req.cookies);
  
  // Clear the token cookie with all possible options
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    path: '/',
    domain: undefined
  });
  
  // Also clear any other auth-related cookies
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    path: '/',
    domain: 'localhost'
  });
  
  console.log('✅ Token cookie cleared');
  return res.status(200).json({ message: "Successfully logged out" });
};

export const getLoggedInUser = async (req, res) => {
  try {
    const { id } = req.user;
    const result = await db.query(
      "SELECT id, account_type FROM devconnect.accounts WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Fetch user error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
