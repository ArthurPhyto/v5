import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCrawler } from './services/crawler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Map pour stocker les crawlers actifs
const activeCrawlers = new Map();

app.use(express.static(join(__dirname, '../dist')));

io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('start-crawl', async (url) => {
    try {
      const crawlerId = `${socket.id}-${Date.now()}`;
      
      const crawler = createCrawler(url, {
        onUrlCrawled: (url) => {
          socket.emit('url-crawled', { crawlerId, url });
        },
        onExpiredDomain: (data) => {
          socket.emit('expired-domain', { crawlerId, ...data });
        },
        onExternalSite: (data) => {
          socket.emit('external-site', { crawlerId, ...data });
        },
        onStats: (stats) => {
          socket.emit('crawl-stats', { crawlerId, ...stats });
        },
        onError: (error) => {
          socket.emit('crawl-error', { crawlerId, ...error });
        },
        onStatusChange: (status, error) => {
          socket.emit('crawl-status', { 
            crawlerId, 
            status,
            error: error || null
          });
        }
      });

      activeCrawlers.set(crawlerId, crawler);
      socket.emit('crawl-created', { crawlerId, url });
      
      await crawler.start();
      
      if (crawler.status === 'completed' || crawler.status === 'error') {
        activeCrawlers.delete(crawlerId);
      }
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  socket.on('stop-crawl', (crawlerId) => {
    const crawler = activeCrawlers.get(crawlerId);
    if (crawler) {
      crawler.stop();
      activeCrawlers.delete(crawlerId);
    }
  });

  socket.on('disconnect', () => {
    // Nettoyer les crawlers de ce socket
    for (const [crawlerId, crawler] of activeCrawlers.entries()) {
      if (crawlerId.startsWith(socket.id)) {
        crawler.stop();
        activeCrawlers.delete(crawlerId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});