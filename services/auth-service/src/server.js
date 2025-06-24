// services/auth-service/src/server.js
import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

/* -------- health-check endpoint -------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));

/* -------- start server (bind to all interfaces) -------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth service running on port ${PORT}`);
});
