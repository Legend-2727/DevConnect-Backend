import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`Company service listening on port ${PORT}`);
});
