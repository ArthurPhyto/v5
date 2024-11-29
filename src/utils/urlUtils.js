export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSameDomain(domain1, domain2) {
  if (!domain1 || !domain2) return false;
  
  // Normalisation des domaines
  const norm1 = domain1.toLowerCase().replace(/^www\./, '');
  const norm2 = domain2.toLowerCase().replace(/^www\./, '');
  
  return norm1 === norm2;
}

export function normalizeUrl(href, base) {
  try {
    const url = new URL(href, base);
    // Suppression des fragments
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}