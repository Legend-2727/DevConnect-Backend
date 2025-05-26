// import express from 'express';

// const app = express();


// app.get('/', (req, res) => {
//   res.send('Auth Service is running!');
// });

// export default app;
import express from 'express';
import db from './db/index.js';
import authRoutes from './routes/auth.route.js';

const app = express();
app.use(express.json());



app.use('/api/v1/auth', authRoutes);

export default app;

