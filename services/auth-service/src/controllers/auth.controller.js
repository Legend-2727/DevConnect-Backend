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

    /* 3️⃣  Stub an empty profile row right away */
    if (accountType === "User") {
      await client.query(
        `INSERT INTO devconnect.users (
           account_id,
           name, education_level, experience_level,
           preferred_roles, description, website, bio
         )
         VALUES ($1, '', '', '', '{}'::text[], '', '', '')`,
        [accountId]
      );
    } else if (accountType === "Company") {
      await client.query(
        `INSERT INTO devconnect.companies (
           account_id, name, website, description
         )
         VALUES ($1, '', '', '')`,
        [accountId]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      accountId,
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
  const { accountType, id, email, password } = req.body;

  if (!accountType || (!id && !email) || !password) {
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
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }
    const account = result.rows[0];

    // 2. verify password
    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // 3. optional JWT cookie
    const token = jwt.sign(
      { id: account.id, type: account.account_type },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 4. success payload
    return res.status(200).json({
      success: true,
      id: account.id,
      email: account.email,
      role: account.account_type,
      redirectURL:
        account.account_type === "User"
          ? "user/dashboard"
          : "company/dashboard",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const logoutUser = (req, res) => {
  res.clearCookie("token");
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
