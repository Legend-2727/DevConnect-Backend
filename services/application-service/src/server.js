import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4006;

/* ---------- health-check endpoint ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));

/* ---------- start server ---------- */
app.listen(PORT, () => {
  console.log(`Application service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
