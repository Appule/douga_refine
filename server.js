import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import open from 'open';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

app.use(express.static('./public'));

let clientConnected = false;

wss.on('connection', (ws) => {
  console.log('WebSocket connected');
  clientConnected = true;

  ws.on('close', () => {
    console.log('WebSocket disconnected');
    clientConnected = false;

    // サーバーを停止
    server.close(() => {
      console.log('Server shut down');
      process.exit();
    });
  });
});

server.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  await open(`http://localhost:${port}`);
});