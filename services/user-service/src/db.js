const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://root:password@db:5432/main',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
