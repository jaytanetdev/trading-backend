import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { analyzeStock } from './analysis';
import {
  Candle,
  CompanyOverview,
  NewsItem,
  Quote,
  Recommendation,
  SearchResult,
  StockResponse,
} from './types';
import { yahooFinance as yf } from './yahoo-finance.provider';

const TTL = {
  STOCK: 15 * 60, // 15 minutes (Yahoo updates every 15 min)
  OVERVIEW: 24 * 60 * 60, // 24 hours
  NEWS: 60 * 60, // 1 hour
  SEARCH: 5 * 60, // 5 minutes
  RECOMMENDATIONS: 2 * 60 * 60, // 2 hours
};

function num(v: unknown): number {
  if (v == null) return NaN;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : NaN;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toAVTimestamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly redis: RedisService) {}

  // ─── Daily Candles ──────────────────────────────────────────────────────

  async getDailyCandles(symbol: string): Promise<Candle[]> {
    const key = `candles:${symbol}`;
    const cached = await this.redis.get<Candle[]>(key);
    if (cached) {
      this.logger.log(`[cache hit] candles:${symbol} (${cached.length} rows)`);
      return cached;
    }

    this.logger.log(`[yahoo] chart ${symbol} — fetching...`);
    const result = (await yf.chart(
      symbol,
      { period1: '1970-01-01', interval: '1d' },
      { validateResult: false },
    )) as { quotes: Array<Record<string, unknown>> };
    this.logger.log(`[yahoo] chart ${symbol} — got ${result.quotes?.length ?? 0} raw rows`);

    const out: Candle[] = [];
    for (const row of result.quotes) {
      if (!row.date) continue;
      const close = (row.close ?? row.adjclose) as number | null | undefined;
      if (close == null) continue;
      const date =
        row.date instanceof Date
          ? row.date
          : new Date(row.date as string | number);
      out.push({
        time: toISODate(date),
        open: num(row.open),
        high: num(row.high),
        low: num(row.low),
        close: num(close),
        volume: num(row.volume),
      });
    }
    out.sort((a, b) => (a.time < b.time ? -1 : 1));

    await this.redis.set(key, out, TTL.STOCK);
    return out;
  }

  // ─── Quote ──────────────────────────────────────────────────────────────

  async getQuote(symbol: string): Promise<Quote> {
    const key = `quote:${symbol}`;
    const cached = await this.redis.get<Quote>(key);
    if (cached) {
      this.logger.log(`[cache hit] quote:${symbol} price=${cached.price}`);
      return cached;
    }

    this.logger.log(`[yahoo] quote ${symbol} — fetching...`);
    const q = await yf.quote(symbol, undefined, { validateResult: false });
    this.logger.log(`[yahoo] quote ${symbol} — price=${q?.regularMarketPrice ?? 'N/A'}`);
    if (!q || q.regularMarketPrice == null) {
      throw new NotFoundException(`Quote not found for ${symbol}`);
    }

    const out: Quote = {
      symbol: q.symbol ?? symbol,
      price: num(q.regularMarketPrice),
      change: num(q.regularMarketChange),
      changePercent: num(q.regularMarketChangePercent),
      volume: num(q.regularMarketVolume),
      open: num(q.regularMarketOpen),
      high: num(q.regularMarketDayHigh),
      low: num(q.regularMarketDayLow),
      prevClose: num(q.regularMarketPreviousClose),
    };

    await this.redis.set(key, out, TTL.STOCK);
    return out;
  }

  // ─── Stock (candles + quote + analysis) ─────────────────────────────────

  async getStock(symbol: string): Promise<StockResponse> {
    const key = `stock:${symbol}`;
    const cached = await this.redis.get<StockResponse>(key);
    if (cached) {
      this.logger.log(`[cache hit] stock:${symbol}`);
      return cached;
    }
    this.logger.log(`[cache miss] stock:${symbol} — building from Yahoo Finance`);

    const [candles, quote] = await Promise.all([
      this.getDailyCandles(symbol),
      this.getQuote(symbol),
    ]);

    if (!candles.length) {
      throw new NotFoundException(`No data found for ${symbol}`);
    }

    const analysis = analyzeStock(candles);
    if (analysis) analysis.symbol = symbol;

    const out: StockResponse = {
      symbol,
      candles: candles.slice(-365),
      quote,
      analysis,
    };

    await this.redis.set(key, out, TTL.STOCK);
    return out;
  }

  // ─── Overview ───────────────────────────────────────────────────────────

  async getOverview(symbol: string): Promise<CompanyOverview> {
    const key = `overview:${symbol}`;
    const cached = await this.redis.get<CompanyOverview>(key);
    if (cached) {
      this.logger.log(`[cache hit] overview:${symbol}`);
      return cached;
    }

    this.logger.log(`[yahoo] quoteSummary ${symbol} — fetching...`);
    const summary = (await yf.quoteSummary(
      symbol,
      {
        modules: [
          'assetProfile',
          'summaryDetail',
          'defaultKeyStatistics',
          'financialData',
          'price',
        ],
      },
      { validateResult: false },
    )) as Record<string, Record<string, unknown> | undefined>;

    const profile = (summary.assetProfile ?? {}) as Record<string, unknown>;
    const detail = (summary.summaryDetail ?? {}) as Record<string, unknown>;
    const stats = (summary.defaultKeyStatistics ?? {}) as Record<
      string,
      unknown
    >;
    const fin = (summary.financialData ?? {}) as Record<string, unknown>;
    const price = (summary.price ?? {}) as Record<string, unknown>;

    this.logger.log(`[yahoo] quoteSummary ${symbol} — got response`);
    if (!price.symbol && !detail.marketCap) {
      throw new NotFoundException(`Overview not found for ${symbol}`);
    }

    const pick = (
      ...keys: { src: Record<string, unknown>; key: string }[]
    ): unknown => {
      for (const { src, key } of keys) {
        const v = src[key];
        if (v != null) return v;
      }
      return undefined;
    };

    const out: CompanyOverview = {
      symbol: String(price.symbol ?? symbol),
      name: String(price.longName ?? price.shortName ?? symbol),
      description: String(profile.longBusinessSummary ?? ''),
      exchange: String(price.exchangeName ?? price.exchange ?? ''),
      sector: String(profile.sector ?? ''),
      industry: String(profile.industry ?? ''),
      country: String(profile.country ?? ''),
      marketCap: num(
        pick(
          { src: price, key: 'marketCap' },
          { src: detail, key: 'marketCap' },
        ),
      ),
      peRatio: num(
        pick(
          { src: detail, key: 'trailingPE' },
          { src: stats, key: 'trailingPE' },
        ),
      ),
      forwardPE: num(
        pick(
          { src: detail, key: 'forwardPE' },
          { src: stats, key: 'forwardPE' },
        ),
      ),
      pegRatio: num(stats.pegRatio),
      eps: num(
        pick(
          { src: stats, key: 'trailingEps' },
          { src: fin, key: 'epsTrailingTwelveMonths' },
        ),
      ),
      dividendYield: num(detail.dividendYield),
      beta: num(
        pick({ src: detail, key: 'beta' }, { src: stats, key: 'beta' }),
      ),
      fiftyTwoWeekHigh: num(detail.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: num(detail.fiftyTwoWeekLow),
      profitMargin: num(
        pick(
          { src: fin, key: 'profitMargins' },
          { src: stats, key: 'profitMargins' },
        ),
      ),
      roe: num(fin.returnOnEquity),
      revenueGrowthYoY: num(fin.revenueGrowth),
      earningsGrowthYoY: num(fin.earningsGrowth),
      priceToBook: num(
        pick(
          { src: detail, key: 'priceToBook' },
          { src: stats, key: 'priceToBook' },
        ),
      ),
      analystTargetPrice: num(fin.targetMeanPrice),
    };

    await this.redis.set(key, out, TTL.OVERVIEW);
    return out;
  }

  // ─── News ────────────────────────────────────────────────────────────────

  async getNews(symbol: string, limit = 10): Promise<NewsItem[]> {
    const key = `news:${symbol}:${limit}`;
    const cached = await this.redis.get<NewsItem[]>(key);
    if (cached) {
      this.logger.log(`[cache hit] news:${symbol} (${cached.length} items)`);
      return cached;
    }

    this.logger.log(`[yahoo] search news ${symbol} — fetching...`);
    const result = (await yf.search(
      symbol,
      { newsCount: limit, quotesCount: 0 },
      { validateResult: false },
    )) as {
      news?: Array<{
        title?: string;
        link?: string;
        publisher?: string;
        providerPublishTime?: Date | string | number;
        thumbnail?: { resolutions?: { url: string }[] };
      }>;
    };

    this.logger.log(`[yahoo] search news ${symbol} — got ${result.news?.length ?? 0} items`);
    const out: NewsItem[] = (result.news ?? []).slice(0, limit).map((n) => {
      const t = n.providerPublishTime;
      const published =
        t instanceof Date ? t : t ? new Date(t as string | number) : new Date();
      return {
        title: n.title ?? '',
        url: n.link ?? '',
        source: n.publisher ?? '',
        publishedAt: toAVTimestamp(published),
        summary: '',
        sentiment: 'neutral',
        sentimentScore: 0,
        banner: n.thumbnail?.resolutions?.[0]?.url,
      };
    });

    await this.redis.set(key, out, TTL.NEWS);
    return out;
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  async searchSymbols(keyword: string): Promise<SearchResult[]> {
    const key = `search:${keyword.toLowerCase()}`;
    const cached = await this.redis.get<SearchResult[]>(key);
    if (cached) {
      this.logger.log(`[cache hit] search:${keyword} (${cached.length} results)`);
      return cached;
    }

    this.logger.log(`[yahoo] search symbols "${keyword}" — fetching...`);
    const result = (await yf.search(
      keyword,
      { quotesCount: 10, newsCount: 0 },
      { validateResult: false },
    )) as { quotes?: unknown[] };

    this.logger.log(`[yahoo] search symbols "${keyword}" — got ${(result as { quotes?: unknown[] }).quotes?.length ?? 0} results`);
    const out: SearchResult[] = [];
    for (const q of result.quotes ?? []) {
      const anyQ = q as Record<string, unknown>;
      const symbol = anyQ.symbol;
      if (typeof symbol !== 'string' || !symbol) continue;
      out.push({
        symbol,
        name: String(anyQ.shortname ?? anyQ.longname ?? anyQ.name ?? symbol),
        region: String(anyQ.exchDisp ?? anyQ.exchange ?? ''),
        type: String(anyQ.typeDisp ?? anyQ.quoteType ?? ''),
      });
    }

    await this.redis.set(key, out, TTL.SEARCH);
    return out;
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  async getRecommendations(): Promise<Recommendation[]> {
    const key = 'movers';
    const cached = await this.redis.get<Recommendation[]>(key);
    if (cached) {
      this.logger.log(`[cache hit] movers (${cached.length} items)`);
      return cached;
    }
    this.logger.log(`[yahoo] screener movers — fetching...`);

    const runScreener = async (
      scrId: 'day_gainers' | 'day_losers' | 'most_actives',
      count: number,
    ): Promise<Record<string, unknown>[]> => {
      try {
        const r = await yf.screener(
          { scrIds: scrId, count },
          undefined,
          { validateResult: false },
        );
        const rec = r as unknown as { quotes?: unknown[] };
        return (rec.quotes ?? []) as Record<string, unknown>[];
      } catch (err) {
        this.logger.warn(`Screener ${scrId} failed: ${String(err)}`);
        return [];
      }
    };

    const [gainers, actives, losers] = await Promise.all([
      runScreener('day_gainers', 5),
      runScreener('most_actives', 5),
      runScreener('day_losers', 3),
    ]);
    this.logger.log(`[yahoo] screener movers — gainers=${gainers.length} actives=${actives.length} losers=${losers.length}`);

    const out: Recommendation[] = [];
    const push = (
      list: Record<string, unknown>[],
      reason: string,
      category: Recommendation['category'],
    ) => {
      for (const m of list) {
        const symbol = m.symbol;
        if (typeof symbol !== 'string' || !symbol) continue;
        out.push({
          symbol,
          name:
            (typeof m.shortName === 'string' && m.shortName) ||
            (typeof m.longName === 'string' && m.longName) ||
            undefined,
          price: num(m.regularMarketPrice),
          changePercent: num(m.regularMarketChangePercent),
          reason,
          category,
        });
      }
    };

    push(gainers, 'หุ้นที่มีโมเมนตัมขาขึ้นแรงสุดในวันนี้', 'TOP_GAINER');
    push(
      actives,
      'วอลุ่มซื้อขายสูงสุด — สภาพคล่องดี เหมาะกับการเข้า-ออกเร็ว',
      'ACTIVE',
    );
    push(
      losers,
      'ปรับฐานแรง — อาจเป็นโอกาสรีบาวน์ทางเทคนิคถ้าพื้นฐานแกร่ง',
      'TOP_LOSER',
    );

    await this.redis.set(key, out, TTL.RECOMMENDATIONS);
    return out;
  }
}
