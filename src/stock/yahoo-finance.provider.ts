import YahooFinance from 'yahoo-finance2';

const BROWSER_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

// YAHOO_PROXY_URL: optional CF Worker URL that proxies Yahoo Finance requests
// for VPS environments where Yahoo Finance's GDPR consent flow is IP-blocked.
// If unset, requests go directly to Yahoo Finance (works on local / unblocked IPs).
const PROXY_URL = process.env.YAHOO_PROXY_URL?.replace(/\/$/, '');

function buildFetch(): typeof fetch | undefined {
  if (!PROXY_URL) return undefined;

  const YAHOO_ORIGINS = [
    'https://finance.yahoo.com',
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com',
    'https://guce.yahoo.com',
    'https://consent.yahoo.com',
  ];

  return (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const matched = YAHOO_ORIGINS.find((o) => raw.startsWith(o));
    if (matched) {
      const proxied = PROXY_URL + raw.slice(matched.length);
      const headers = new Headers(init?.headers);
      headers.set('X-Yahoo-Origin', matched.replace('https://', ''));
      return globalThis.fetch(proxied, { ...init, headers });
    }
    return globalThis.fetch(input, init);
  };
}

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  fetchOptions: { headers: BROWSER_HEADERS },
  ...(buildFetch() ? { fetch: buildFetch() } : {}),
});

export { yf as yahooFinance };
export type { YahooFinance };
