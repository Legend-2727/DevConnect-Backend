import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/user.routes.js';
import aiRoutes from './routes/ai.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3333', 'http://frontend:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use('/files', express.static(path.join(__dirname, '..', 'uploads')));
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.use('/api/v1/users', userRoutes);
app.use('/api/ai', aiRoutes);

export default app;
