export class CrawlQueue {
  constructor() {
    this.queue = new Set();
    this.processing = new Set();
  }

  add(url) {
    if (!this.queue.has(url) && !this.processing.has(url)) {
      this.queue.add(url);
    }
  }

  next() {
    for (const url of this.queue) {
      this.queue.delete(url);
      this.processing.add(url);
      return url;
    }
    return null;
  }

  isEmpty() {
    return this.queue.size === 0;
  }
}