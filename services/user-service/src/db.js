// services/user-service/src/db.js
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://root:password@db:5432/main",
});

export default {
  query: (text, params) => pool.query(text, params),
};
