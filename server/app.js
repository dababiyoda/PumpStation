import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export function createApp() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const app = express();
  const httpServer = createServer(app);

  app.use(express.static(join(__dirname, '../client')));

  const io = new Server(httpServer, {
    cors: {
      origin: '*'
    }
  });

  app.use(cors());
  app.use(express.json());

  const votes = {};
  const votedWallets = new Set();

  app.get('/api/votes', (req, res) => {
    res.json(votes);
  });

  app.post('/api/vote', (req, res) => {
    const { wallet, coin } = req.body || {};
    if (!wallet || !coin) {
      return res.status(400).json({ error: 'wallet and coin required' });
    }
    if (votedWallets.has(wallet)) {
      return res.status(400).json({ error: 'wallet already voted' });
    }
    votedWallets.add(wallet);
    votes[coin] = (votes[coin] || 0) + 1;
    io.emit('votes', votes);
    res.json({ success: true, votes });
  });

  io.on('connection', socket => {
    socket.emit('votes', votes);
  });

  return { app, httpServer };
}
