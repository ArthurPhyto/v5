import { io } from 'socket.io-client';

class CrawlerUI {
    constructor(crawlerId, url, savedState = null) {
        this.crawlerId = crawlerId;
        this.url = url;
        this.element = this.createCrawlerElement();
        document.getElementById('crawlersContainer').prepend(this.element);
        
        // Ajouter les boutons d'action
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'crawler-actions';
        
        const stopButton = document.createElement('button');
        stopButton.textContent = 'Arrêter';
        stopButton.className = 'stop-button';
        stopButton.onclick = () => socket.emit('stop-crawl', this.crawlerId);
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Supprimer';
        deleteButton.className = 'delete-button';
        deleteButton.onclick = () => this.delete();
        
        actionsDiv.appendChild(stopButton);
        actionsDiv.appendChild(deleteButton);
        this.element.querySelector('.crawler-header').appendChild(actionsDiv);

        // Restaurer l'état sauvegardé si disponible
        if (savedState) {
            this.restoreState(savedState);
        }
    }

    createCrawlerElement() {
        const template = document.getElementById('crawlerTemplate');
        const element = template.content.cloneNode(true).firstElementChild;
        
        element.id = this.crawlerId;
        element.querySelector('.crawler-url').textContent = this.url;
        
        return element;
    }

    updateStatus(status, error = null) {
        const statusElement = this.element.querySelector('.crawler-status');
        statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        statusElement.className = `crawler-status ${status}`;

        const stopButton = this.element.querySelector('.stop-button');
        if (status === 'completed' || status === 'error' || status === 'stopped') {
            stopButton.style.display = 'none';
        }

        const errorContainer = this.element.querySelector('.error-container');
        if (error) {
            errorContainer.textContent = `Erreur: ${error}`;
            errorContainer.classList.add('visible');
        } else {
            errorContainer.classList.remove('visible');
        }

        this.saveState();
    }

    addUrl(url) {
        this.addItemToList('crawled-urls', url);
        this.saveState();
    }

    addExternalSite(data) {
        const statusClass = data.statusCode >= 200 && data.statusCode < 300 ? 'success' : 
                          data.statusCode >= 300 && data.statusCode < 400 ? 'warning' : 'error';
        
        const html = `${data.domain} (${data.url})
            <div class="status-code ${statusClass}">Status: ${data.statusCode} ${data.statusText || ''}</div>
            <div class="source-url">Source: ${data.sourceUrl}</div>`;
        this.addItemToList('external-sites', html, true);
        this.saveState();
    }

    addExpiredDomain(data) {
        const html = `<div class="domain-info">
            <div class="domain-name">${data.domain}</div>
            <div class="check-results">${data.reason.split('\n').map(line => 
                `<div class="check-result ${line.startsWith('✓') ? 'success' : line.startsWith('⚠') ? 'warning' : 'error'}">${line}</div>`
            ).join('')}</div>
        </div>`;
        this.addItemToList('expired-domains', html, true);
        this.saveState();
    }

    addError(error) {
        const html = `${error.url}: ${error.error}`;
        const div = document.createElement('div');
        div.className = 'url-item error';
        div.textContent = html;
        this.element.querySelector('.error-container').appendChild(div);
        this.saveState();
    }

    updateStats(stats) {
        this.element.querySelector('.crawled-count').textContent = stats.crawledCount;
        this.element.querySelector('.external-count').textContent = stats.externalCount;
        this.element.querySelector('.error-count').textContent = stats.errorCount;
        this.saveState();
    }

    addItemToList(className, content, isHTML = false) {
        const div = document.createElement('div');
        div.className = 'url-item';
        if (isHTML) {
            div.innerHTML = content;
        } else {
            div.textContent = content;
        }
        const container = this.element.querySelector(`.${className}`);
        container.appendChild(div);
    }

    saveState() {
        const state = {
            url: this.url,
            status: this.element.querySelector('.crawler-status').textContent,
            stats: {
                crawledCount: this.element.querySelector('.crawled-count').textContent,
                externalCount: this.element.querySelector('.external-count').textContent,
                errorCount: this.element.querySelector('.error-count').textContent
            },
            crawledUrls: Array.from(this.element.querySelector('.crawled-urls').children).map(el => el.textContent),
            externalSites: Array.from(this.element.querySelector('.external-sites').children).map(el => el.innerHTML),
            expiredDomains: Array.from(this.element.querySelector('.expired-domains').children).map(el => el.innerHTML),
            error: this.element.querySelector('.error-container').textContent
        };

        const savedCrawls = JSON.parse(localStorage.getItem('savedCrawls') || '{}');
        savedCrawls[this.crawlerId] = state;
        localStorage.setItem('savedCrawls', JSON.stringify(savedCrawls));
    }

    restoreState(state) {
        this.updateStatus(state.status);
        this.updateStats(state.stats);
        
        state.crawledUrls.forEach(url => this.addUrl(url));
        state.externalSites.forEach(html => this.addItemToList('external-sites', html, true));
        state.expiredDomains.forEach(html => this.addItemToList('expired-domains', html, true));
        
        if (state.error) {
            const errorContainer = this.element.querySelector('.error-container');
            errorContainer.textContent = state.error;
            errorContainer.classList.add('visible');
        }
    }

    delete() {
        // Supprimer du localStorage
        const savedCrawls = JSON.parse(localStorage.getItem('savedCrawls') || '{}');
        delete savedCrawls[this.crawlerId];
        localStorage.setItem('savedCrawls', JSON.stringify(savedCrawls));

        // Supprimer l'élément du DOM
        this.element.remove();
        crawlers.delete(this.crawlerId);
    }
}

const socket = io(window.location.origin);
const crawlers = new Map();

// Restaurer les crawls sauvegardés au chargement
window.addEventListener('DOMContentLoaded', () => {
    const savedCrawls = JSON.parse(localStorage.getItem('savedCrawls') || '{}');
    Object.entries(savedCrawls).forEach(([crawlerId, state]) => {
        const crawler = new CrawlerUI(crawlerId, state.url, state);
        crawlers.set(crawlerId, crawler);
    });
});

window.startNewCrawl = function() {
    const url = document.getElementById('urlInput').value;
    if (!url) {
        alert('Veuillez entrer une URL valide');
        return;
    }
    
    socket.emit('start-crawl', url);
    document.getElementById('urlInput').value = '';
};

socket.on('crawl-created', ({ crawlerId, url }) => {
    const crawler = new CrawlerUI(crawlerId, url);
    crawlers.set(crawlerId, crawler);
});

socket.on('url-crawled', ({ crawlerId, url }) => {
    const crawler = crawlers.get(crawlerId);
    if (crawler) crawler.addUrl(url);
});

socket.on('external-site', ({ crawlerId, ...data }) => {
    const crawler = crawlers.get(crawlerId);
    if (crawler) crawler.addExternalSite(data);
});

socket.on('expired-domain', ({ crawlerId, ...data }) => {
    const crawler = crawlers.get(crawlerId);
    if (crawler) crawler.addExpiredDomain(data);
});

socket.on('crawl-error', ({ crawlerId, ...error }) => {
    const crawler = crawlers.get(crawlerId);
    if (crawler) crawler.addError(error);
});

socket.on('crawl-stats', ({ crawlerId, ...stats }) => {
    const crawler = crawlers.get(crawlerId);
    if (crawler) crawler.updateStats(stats);
});

socket.on('crawl-status', ({ crawlerId, status, error }) => {
    const crawler = crawlers.get(crawlerId);
    if (crawler) crawler.updateStatus(status, error);
});

socket.on('error', (message) => {
    alert(`Erreur: ${message}`);
});