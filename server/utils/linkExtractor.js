export function extractLinks($, baseUrl) {
  const links = new Set();

  // Recherche tous les liens (a href et autres attributs contenant des URLs)
  const linkSelectors = [
    'a[href]',
    'link[href]',
    'script[src]',
    'img[src]',
    'iframe[src]',
    'area[href]',
    'base[href]',
    '[style*="url("]'
  ];

  $(linkSelectors.join(', ')).each((_, element) => {
    let href = $(element).attr('href') || $(element).attr('src');
    
    // Extraction des URLs des styles CSS
    if (!href && $(element).attr('style')) {
      const styleUrls = $(element).attr('style').match(/url\(['"]?([^'")\s]+)['"]?\)/g);
      if (styleUrls) {
        styleUrls.forEach(styleUrl => {
          href = styleUrl.replace(/url\(['"]?([^'")\s]+)['"]?\)/, '$1');
          if (href) links.add(href);
        });
      }
    }

    if (href) links.add(href);
  });

  return links;
}