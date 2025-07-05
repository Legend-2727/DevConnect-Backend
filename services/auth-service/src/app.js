import express from 'express';
import cors from 'cors';
import db from './db/index.js';
import authRoutes from './routes/auth.route.js';
import cookieParser from 'cookie-parser';

const app = express();

// Recommended CORS setup
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3333', 'http://frontend:3000'], // Allow multiple origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser()); // ⬅️ Must come BEFORE routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use('/api/v1/auth', authRoutes);

export default app;
