const express = require('express');
const app = express();
const PORT = process.env.PORT || 4004;

app.get('/', (req, res) => {
  res.send('User service is running');
});

app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
