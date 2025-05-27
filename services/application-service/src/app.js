import express from 'express';
import cors from 'cors';

const app = express();

// Recommended CORS setup
app.use(cors({
  origin: process.env.FRONTEND || 'http://localhost:3000', // frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// ... configure routes, middlewares

export default app;
