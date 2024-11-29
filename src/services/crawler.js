import axios from 'axios';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import { lookupDomain } from './domainChecker.js';
import { extractDomain, isValidUrl, isSameDomain, normalizeUrl } from '../utils/urlUtils.js';
import { CrawlQueue } from '../utils/queue.js';
import { extractLinks } from '../utils/linkExtractor.js';

const crawledUrls = new Set();
const foundDomains = new Set();
const externalSites = new Set();
const errors = new Map();

export async function startCrawler(startUrl, callbacks) {
  const { onUrlCrawled, onExpiredDomain, onExternalSite, onStats, onError } = callbacks;
  
  if (!isValidUrl(startUrl)) {
    throw new Error('URL invalide');
  }

  const baseDomain = extractDomain(startUrl);
  const queue = new CrawlQueue();
  queue.add(startUrl);

  while (!queue.isEmpty()) {
    const url = queue.next();
    if (!url) continue;

    try {
      const newUrls = await crawlUrl(url, baseDomain, callbacks);
      newUrls.forEach(newUrl => queue.add(newUrl));
    } catch (error) {
      const errorMessage = `Erreur sur ${url}: ${error.message}`;
      errors.set(url, errorMessage);
      onError({ url, error: errorMessage });
    }
  }
}

async function crawlUrl(url, baseDomain, callbacks) {
  const { onUrlCrawled, onExpiredDomain, onExternalSite, onStats, onError } = callbacks;
  const newUrls = new Set();
  
  if (crawledUrls.has(url)) return newUrls;
  crawledUrls.add(url);

  onStats({
    crawledCount: crawledUrls.size,
    externalCount: externalSites.size,
    errorCount: errors.size
  });

  try {
    console.log(chalk.blue(`Crawling: ${url}`));
    onUrlCrawled(url);

    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      validateStatus: status => status < 400
    });

    const $ = cheerio.load(response.data);
    const links = extractLinks($, url);

    for (const href of links) {
      try {
        const absoluteUrl = normalizeUrl(href, url);
        if (!absoluteUrl || !isValidUrl(absoluteUrl)) continue;

        const domain = extractDomain(absoluteUrl);
        if (!domain) continue;

        if (!isSameDomain(domain, baseDomain)) {
          if (!externalSites.has(domain)) {
            externalSites.add(domain);
            onExternalSite({
              domain,
              url: absoluteUrl,
              sourceUrl: url
            });

            lookupDomain(domain).then(isExpired => {
              if (isExpired) {
                console.log(chalk.green(`Domaine expiré trouvé: ${domain}`));
                onExpiredDomain(domain);
              }
            }).catch(error => {
              onError({ url: domain, error: `Erreur WHOIS: ${error.message}` });
            });
          }
        } else {
          newUrls.add(absoluteUrl);
        }
      } catch (error) {
        onError({ url: href, error: `URL invalide: ${error.message}` });
      }
    }

    return newUrls;
  } catch (error) {
    let errorMessage = `Erreur lors du crawl: ${error.message}`;
    if (error.response) {
      errorMessage += ` (Status: ${error.response.status})`;
    }
    throw new Error(errorMessage);
  }
}