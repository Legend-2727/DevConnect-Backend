import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import applicationRoutes from './routes/application.routes.js';

const app = express();

// Recommended CORS setup
app.use(cors({
  origin: [
    process.env.FRONTEND || 'http://localhost:3000',
    `http://${process.env.CORSFIX}:3000`
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/v1', applicationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'application-service' });
});

export default app;
