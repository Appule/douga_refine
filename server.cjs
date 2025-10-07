const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

// 実行ファイルのある場所を基準に public フォルダを参照
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

wss.on('connection', (ws) => {
  console.log('🟢 WebSocket connected');
  ws.on('close', () => {
    console.log('🔴 WebSocket disconnected');
    server.close(() => {
      console.log('🛑 Server shut down');
      process.exit();
    });
  });
});

server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  exec(`start http://localhost:${port}`);
});
