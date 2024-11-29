import whois from 'whois-json';

export async function lookupDomain(domain) {
  try {
    const result = await whois(domain);
    
    if (!result.expirationDate) {
      return false;
    }

    const expirationDate = new Date(result.expirationDate);
    const now = new Date();
    
    return expirationDate < now;
  } catch (error) {
    console.error(`Erreur lors de la vérification du domaine ${domain}:`, error);
    throw error;
  }
}