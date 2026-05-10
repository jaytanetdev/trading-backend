import YahooFinance from 'yahoo-finance2';

// Yahoo Finance redirects cloud/EU IPs to a GDPR consent page.
// Sending en-US Accept-Language tells Yahoo to treat the request as US-based,
// bypassing the redirect entirely.
if (typeof globalThis.fetch !== 'undefined') {
  const _orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('yahoo')) {
      const headers = new Headers(init?.headers);
      headers.set('Accept-Language', 'en-US,en;q=0.9');
      headers.set(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      );
      return _orig(input, { ...init, headers });
    }
    return _orig(input, init);
  };
}

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export { yf as yahooFinance };
export type { YahooFinance };
