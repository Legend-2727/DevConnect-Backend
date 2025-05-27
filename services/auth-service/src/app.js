import express from 'express';
import cors from 'cors';
import db from './db/index.js';
import authRoutes from './routes/auth.route.js';
import cookieParser from 'cookie-parser';

const app = express();

// Recommended CORS setup
app.use(cors({
  origin: process.env.FRONTEND || 'http://localhost:3000', // your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser()); // ⬅️ Must come BEFORE routes
app.use('/api/v1/auth', authRoutes);

export default app;
