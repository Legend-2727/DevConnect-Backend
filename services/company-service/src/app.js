// import express from 'express';
// import companyRoutes from './routes/company.routes.js';
// import aiRoutes from './routes/ai.routes.js';
// const app = express();
// app.use(express.json());
// app.use('/api/company', companyRoutes);
// app.use('/api/ai', aiRoutes);



// export default app;

import express from 'express';
import companyRoutes from './routes/company.routes.js';
import aiRoutes from './routes/ai.routes.js';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost',
    `http://${process.env.CORSFIX}`,
    'http://localhost:3000',
    `http://${process.env.CORSFIX}:3000`,
    'http://localhost:80',
    `http://${process.env.CORSFIX}:80`,
    process.env.FRONTEND || 'http://localhost'
  ],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev')); // HTTP request logger

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files for uploaded logos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'company-service' });
});

// Routes
app.use('/api/v1/companies', companyRoutes);
app.use('/api/ai', aiRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle uncaught promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

export default app;


