import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4003;

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});