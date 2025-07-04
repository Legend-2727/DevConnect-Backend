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

const app = express();

// Middleware
app.use(express.json());
app.use(morgan('dev')); // HTTP request logger

// Routes
app.use('/api/company', companyRoutes);
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


