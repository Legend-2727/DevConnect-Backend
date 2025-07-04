import express from 'express';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/user.routes.js';
import aiRoutes from './routes/ai.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use('/files', express.static(path.join(__dirname, '..', 'uploads')));
app.use(cookieParser());
app.use('/api/v1/users', userRoutes);
app.use('/api/ai', aiRoutes);

export default app;
