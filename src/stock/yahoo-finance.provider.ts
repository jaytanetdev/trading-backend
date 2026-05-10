import YahooFinance from 'yahoo-finance2';

// Suppress noisy console notices from the library
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export { yf as yahooFinance };
export type { YahooFinance };
