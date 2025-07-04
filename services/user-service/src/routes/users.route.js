// services/user-service/src/routes/users.route.js
import { Router } from "express";
import db          from "../db.js";

const router = Router();

/* ───────────────────────────── GET profile ────────────────────────────────
   GET /api/v1/users/:accountId
   – Returns a single user profile (joins the accounts table to get e-mail)
---------------------------------------------------------------------------*/
router.get("/:accountId", async (req, res) => {
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
         u.bio,
         u.cv_url,
         u.joined_at
       FROM devconnect.users    AS u
       JOIN devconnect.accounts AS a ON a.id = u.account_id
       WHERE u.account_id = $1`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("GET /users error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

/* ───────────────────────────── PATCH profile ──────────────────────────────
   PATCH /api/v1/users/:accountId
   – Allows partial updates. Only supplied fields are changed.
---------------------------------------------------------------------------*/
router.patch("/:accountId", async (req, res) => {
  const { accountId } = req.params;

  // Pull every allowed field off the body (leave the rest untouched)
  const {
    name,
    education_level,
    experience_level,
    preferred_roles,   // ← array e.g. ["Backend Developer"]
    website,
    description,
    bio,
    cv_url,
  } = req.body;

  /* Nothing to update?  Abort early. */
  if (
    name === undefined &&
    education_level === undefined &&
    experience_level === undefined &&
    preferred_roles === undefined &&
    website === undefined &&
    description === undefined &&
    bio === undefined &&
    cv_url === undefined
  ) {
    return res
      .status(400)
      .json({ success: false, error: "No updatable fields supplied" });
  }

  try {
    const result = await db.query(
      `UPDATE devconnect.users
         SET name             = COALESCE($2, name),
             education_level  = COALESCE($3, education_level),
             experience_level = COALESCE($4, experience_level),
             preferred_roles  = COALESCE($5, preferred_roles),
             website          = COALESCE($6, website),
             description      = COALESCE($7, description),
             bio              = COALESCE($8, bio),
             cv_url           = COALESCE($9, cv_url)
       WHERE account_id = $1
       RETURNING *`,
      [
        accountId,
        name,
        education_level,
        experience_level,
        preferred_roles,
        website,
        description,
        bio,
        cv_url,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("PATCH /users error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

export default router;
