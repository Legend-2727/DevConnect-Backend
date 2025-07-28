// services/user-service/src/server.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import userRoutes from './routes/user.routes.js';
import aiRoutes from './routes/ai.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4004;

// Middleware
app.use(cors({
  origin: [
    'http://localhost',
    `http://${process.env.CORSFIX}`,
    'http://localhost:3000',
    `http://${process.env.CORSFIX}:3000`,
    'http://localhost:80',
    `http://${process.env.CORSFIX}:80`,
    'http://localhost:8000',
    `http://${process.env.CORSFIX}:8000`,
    'http://localhost:4002',
    `http://${process.env.CORSFIX}:4002`,
  ],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static('/app/uploads'));

/* ---------- health-check endpoints ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/', (_req, res) => res.send('User service is running'));

/* ---------- routes ---------- */
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/ai', aiRoutes);

/* ---------- start server ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`User service running on port ${PORT}`);
});
