import express from 'express';
import cors from 'cors';
import db from './db/index.js';
import authRoutes from './routes/auth.route.js';
import cookieParser from 'cookie-parser';

const app = express();

// Recommended CORS setup
app.use(cors({
  origin: [
    'http://localhost',
    `http://${process.env.CORSFIX}`,
    'http://localhost:3000',
    `http://${process.env.CORSFIX}:3000`,
    'http://localhost:80',
    `http://${process.env.CORSFIX}:80`,
    process.env.FRONTEND || 'http://localhost'
  ],// your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser()); // ⬅️ Must come BEFORE routes
app.use('/api/v1/auth', authRoutes);

export default app;
