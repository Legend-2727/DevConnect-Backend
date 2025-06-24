import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4003;

/* ---------- health-check endpoint ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));

/* ---------- start server ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Application service running on port ${PORT}`);
});
