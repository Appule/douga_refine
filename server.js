const express = require('express');
const open = require('open');
const app = express();
const port = 3000;

app.use(express.static(__dirname + '/public'));

app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  await open(`http://localhost:${port}`);
});