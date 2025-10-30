const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

const configPath = path.join(process.cwd(), '_config');
app.use('/_config', express.static(configPath));

let shutdownTimer = null;
const SHUTDOWN_DELAY_MS = 1000;

wss.on('connection', (ws) => {
  console.log('🟢 WebSocket connected');

  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
    console.log('Reconnection detected — abort shutdown');
  }

  ws.on('close', () => {
    console.log('🔴 WebSocket disconnected');
    if (wss.clients.size === 0) {
      shutdownTimer = setTimeout(() => {
        shutdownTimer = null;
        console.log(`No reconnection within ${SHUTDOWN_DELAY_MS}ms — shutting down`);
        server.close(() => {
          console.log('Server shut down');
          process.exit();
        });
      }, SHUTDOWN_DELAY_MS);
    } else {
      console.log('Other clients still connected — not shutting down');
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  exec(`start http://localhost:${port}`);
});
