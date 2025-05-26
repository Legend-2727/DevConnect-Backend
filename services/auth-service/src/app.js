import express from 'express';
import db from './db/index.js';
import authRoutes from './routes/auth.route.js';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser()); // ⬅️ Must come BEFORE routes
app.use('/api/v1/auth', authRoutes);

export default app;
