import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startCrawler } from './services/crawler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('start-crawl', async (url) => {
    try {
      await startCrawler(url, {
        onUrlCrawled: (url) => {
          socket.emit('url-crawled', url);
        },
        onExpiredDomain: (domain) => {
          socket.emit('expired-domain', domain);
        },
        onExternalSite: (data) => {
          socket.emit('external-site', data);
        },
        onStats: (stats) => {
          socket.emit('crawl-stats', stats);
        },
        onError: (error) => {
          socket.emit('crawl-error', error);
        }
      });
    } catch (error) {
      socket.emit('error', error.message);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});