// services/user-service/src/server.js
import express  from "express";
import cors     from "cors";
import db       from "./db.js";   // ← adjust if your path differs

const app  = express();
const PORT = process.env.PORT || 4004;

/* ───────────────────────── middleware ─────────────────────────── */
app.use(cors());
app.use(express.json());                      // parse JSON bodies

/* ──────────────────────── health-checks ───────────────────────── */
app.get("/health", (_req, res) => res.sendStatus(200));
app.get("/",       (_req, res) => res.send("User service is running"));

/* ───────────────────────── GET profile ────────────────────────── */
app.get("/api/v1/users/:accountId", async (req, res) => {
  const { accountId } = req.params;

  try {
    const result = await db.query(
      `SELECT
         u.name,
         a.email,
         u.education_level,
         u.experience_level,
         u.preferred_roles,
         u.description,
         u.website,
         u.bio
       FROM devconnect.users     AS u
       JOIN devconnect.accounts  AS a ON a.id = u.account_id
       WHERE u.account_id = $1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* ─────────────────────── PATCH  profile ─────────────────────────
   • Accepts *any* of the allowed fields below.
   • All SQL is parameterised  →  safe from injection.
------------------------------------------------------------------*/
app.patch("/api/v1/users/:accountId", async (req, res) => {
  const { accountId } = req.params;
  const {
    name,
    email,                 // lives on devconnect.accounts
    education_level,
    experience_level,
    preferred_roles,
    description,
    website,
    bio,
  } = req.body;

  // build dynamic SET list only for provided props
  const userFields = {
    name,
    education_level,
    experience_level,
    preferred_roles,
    description,
    website,
    bio,
  };

  const setParts = [];
  const values   = [];
  let   idx      = 1;

  for (const [col, val] of Object.entries(userFields)) {
    if (val === undefined) continue;          // skip untouched fields
    setParts.push(`${col} = $${idx}`);
    values.push(val);
    idx++;
  }

  /* no user-table columns requested AND no email ⇒ nothing to do */
  if (setParts.length === 0 && email === undefined) {
    return res.status(400).json({ success: false, error: "No updatable fields supplied" });
  }

  // always keep accountId as the final placeholder
  values.push(accountId);

  try {
    await db.query("BEGIN");

    /* 1️⃣ update devconnect.users (if needed) */
    if (setParts.length) {
      await db.query(
        `UPDATE devconnect.users
         SET ${setParts.join(", ")}
         WHERE account_id = $${values.length}`,   // last value = accountId
        values
      );
    }

    /* 2️⃣ update devconnect.accounts.email (if needed) */
    if (email !== undefined) {
      await db.query(
        `UPDATE devconnect.accounts
         SET email = $1
         WHERE id = $2`,
        [email, accountId]
      );
    }

    /* 3️⃣ return the fresh row */
    const fresh = await db.query(
      `SELECT
         u.name,
         a.email,
         u.education_level,
         u.experience_level,
         u.preferred_roles,
         u.description,
         u.website,
         u.bio
       FROM devconnect.users     AS u
       JOIN devconnect.accounts  AS a ON a.id = u.account_id
       WHERE u.account_id = $1`,
      [accountId]
    );

    await db.query("COMMIT");
    return res.status(200).json({ success: true, user: fresh.rows[0] });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Error updating user:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* ─────────────────────── start server ────────────────────────── */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`User service running on port ${PORT}`);
});
