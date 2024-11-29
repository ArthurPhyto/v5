import whois from 'whois-json';
import dns from 'dns';
import { promisify } from 'util';

const resolveNs = promisify(dns.resolveNs);
const resolveMx = promisify(dns.resolveMx);
const resolveA = promisify(dns.resolve4);

export async function lookupDomain(domain) {
  try {
    const checks = {
      a: { status: 'pending', result: null },
      mx: { status: 'pending', result: null },
      ns: { status: 'pending', result: null },
      whois: { status: 'pending', result: null }
    };

    // 1. Vérification des enregistrements A en premier
    try {
      const aRecords = await resolveA(domain);
      if (!aRecords || aRecords.length === 0) {
        checks.a = { status: 'error', error: 'Aucune adresse IP trouvée' };
      } else {
        checks.a = { status: 'success', result: aRecords };
      }
    } catch (error) {
      checks.a = { status: 'error', error: error.message };
    }

    // 2. Vérification des enregistrements MX
    try {
      const mxRecords = await resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        checks.mx = { status: 'error', error: 'Aucun serveur de messagerie trouvé' };
      } else {
        checks.mx = { status: 'success', result: mxRecords };
      }
    } catch (error) {
      checks.mx = { status: 'error', error: error.message };
    }

    // 3. Vérification des serveurs DNS (NS)
    try {
      const nsRecords = await resolveNs(domain);
      if (!nsRecords || nsRecords.length === 0) {
        checks.ns = { status: 'error', error: 'Aucun serveur DNS trouvé' };
      } else {
        checks.ns = { status: 'success', result: nsRecords };
      }
    } catch (error) {
      checks.ns = { status: 'error', error: error.message };
    }

    // 4. Vérification WHOIS
    try {
      const whoisResult = await whois(domain);
      if (whoisResult.expirationDate) {
        const expirationDate = new Date(whoisResult.expirationDate);
        const now = new Date();
        checks.whois = {
          status: 'success',
          result: {
            expirationDate,
            isExpired: expirationDate < now
          }
        };
      } else {
        checks.whois = {
          status: 'warning',
          error: 'Pas de date d\'expiration trouvée'
        };
      }
    } catch (error) {
      checks.whois = { status: 'error', error: error.message };
    }

    // Analyse des résultats
    const summary = [];
    let isExpired = false;

    // Vérification A (prioritaire)
    if (checks.a.status === 'error') {
      summary.push('✗ Pas d\'adresse IP');
      isExpired = true;
    } else {
      summary.push(`✓ Adresses IP présentes (${checks.a.result.length})`);
    }

    // Vérification MX
    if (checks.mx.status === 'error') {
      summary.push('✗ Pas de serveur de messagerie');
    } else {
      summary.push(`✓ Serveurs de messagerie présents (${checks.mx.result.length})`);
    }

    // Vérification NS
    if (checks.ns.status === 'error') {
      summary.push('✗ Pas de serveurs DNS');
      // Ne pas marquer comme expiré si on a des IPs malgré l'absence de NS
      if (checks.a.status === 'error') {
        isExpired = true;
      }
    } else {
      summary.push(`✓ Serveurs DNS présents (${checks.ns.result.length})`);
    }

    // Vérification WHOIS
    if (checks.whois.status === 'success') {
      if (checks.whois.result.isExpired) {
        summary.push(`✗ WHOIS: Domaine expiré depuis ${checks.whois.result.expirationDate.toLocaleDateString()}`);
        isExpired = true;
      } else {
        summary.push(`✓ WHOIS: Expire le ${checks.whois.result.expirationDate.toLocaleDateString()}`);
      }
    } else if (checks.whois.status === 'warning') {
      summary.push('⚠ WHOIS: Pas de date d\'expiration trouvée');
    } else {
      summary.push(`✗ WHOIS: ${checks.whois.error}`);
    }

    return {
      isExpired,
      reason: summary.join('\n'),
      checks
    };
  } catch (error) {
    console.error(`Erreur lors de la vérification du domaine ${domain}:`, error);
    throw error;
  }
}