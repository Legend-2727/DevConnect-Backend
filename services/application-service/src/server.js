import app from './app.js';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';

dotenv.config();

const PORT = process.env.PORT || 4006;

/* ---------- middleware ---------- */
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

/* ---------- static files ---------- */
// Serve static files from uploads directory
app.use('/uploads', express.static('/app/uploads'));
// Ensure the customized CVs are accessible
app.use('/uploads/customized_cvs', express.static('/app/uploads/customized_cvs'));

/* ---------- health-check endpoint ---------- */
app.get('/health', (_req, res) => res.status(200).send('OK'));

/* ---------- start server ---------- */
app.listen(PORT, () => {
  console.log(`Application service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
