import express from 'express';
import cors from 'cors';

const app = express();

// Recommended CORS setup
app.use(cors({
  origin: 'http://localhost:3001', // frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// ... configure routes, middlewares

export default app;
