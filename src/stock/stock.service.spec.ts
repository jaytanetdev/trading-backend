import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StockService } from './stock.service';
import { RedisService } from '../redis/redis.service';

// Mock the yahoo-finance provider module
jest.mock('./yahoo-finance.provider', () => ({
  yahooFinance: {
    chart: jest.fn(),
    quote: jest.fn(),
    quoteSummary: jest.fn(),
    search: jest.fn(),
    screener: jest.fn(),
  },
}));

import { yahooFinance as yf } from './yahoo-finance.provider';

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const sampleCandles = Array.from({ length: 200 }, (_, i) => ({
  time: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
  open: 100 + i * 0.1,
  high: 102 + i * 0.1,
  low: 99 + i * 0.1,
  close: 101 + i * 0.1,
  volume: 1_000_000 + i * 1000,
}));

describe('StockService', () => {
  let service: StockService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  // ─── getDailyCandles ───────────────────────────────────────────────────

  describe('getDailyCandles', () => {
    it('returns cached data when cache hit', async () => {
      mockRedisService.get.mockResolvedValueOnce(sampleCandles);

      const result = await service.getDailyCandles('AAPL');

      expect(result).toBe(sampleCandles);
      expect(yf.chart).not.toHaveBeenCalled();
    });

    it('fetches from Yahoo and caches on cache miss', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      const mockDate = new Date('2024-01-15');
      (yf.chart as jest.Mock).mockResolvedValueOnce({
        quotes: [
          {
            date: mockDate,
            open: 100,
            high: 105,
            low: 98,
            close: 102,
            volume: 1_000_000,
          },
        ],
      });

      const result = await service.getDailyCandles('AAPL');

      expect(yf.chart).toHaveBeenCalledWith(
        'AAPL',
        { period1: '1970-01-01', interval: '1d' },
        { validateResult: false },
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'candles:AAPL',
        expect.any(Array),
        15 * 60,
      );
      expect(result).toHaveLength(1);
      expect(result[0].time).toBe('2024-01-15');
    });

    it('filters out candles without close prices', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.chart as jest.Mock).mockResolvedValueOnce({
        quotes: [
          { date: new Date('2024-01-01'), open: 100, high: 105, low: 98, close: null, volume: 1000 },
          { date: new Date('2024-01-02'), open: 100, high: 105, low: 98, close: 102, volume: 1000 },
        ],
      });

      const result = await service.getDailyCandles('AAPL');
      expect(result).toHaveLength(1);
    });
  });

  // ─── getQuote ─────────────────────────────────────────────────────────

  describe('getQuote', () => {
    it('returns cached quote on cache hit', async () => {
      const cachedQuote = { symbol: 'AAPL', price: 150, change: 1, changePercent: 0.67 };
      mockRedisService.get.mockResolvedValueOnce(cachedQuote);

      const result = await service.getQuote('AAPL');

      expect(result).toBe(cachedQuote);
      expect(yf.quote).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when Yahoo returns no data', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.quote as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.getQuote('INVALID')).rejects.toThrow(NotFoundException);
    });

    it('fetches quote from Yahoo and caches result', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.quote as jest.Mock).mockResolvedValueOnce({
        symbol: 'AAPL',
        regularMarketPrice: 150,
        regularMarketChange: 1.5,
        regularMarketChangePercent: 1.01,
        regularMarketVolume: 50_000_000,
        regularMarketOpen: 148,
        regularMarketDayHigh: 151,
        regularMarketDayLow: 147,
        regularMarketPreviousClose: 148.5,
      });

      const result = await service.getQuote('AAPL');

      expect(result.symbol).toBe('AAPL');
      expect(result.price).toBe(150);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'quote:AAPL',
        expect.objectContaining({ symbol: 'AAPL' }),
        15 * 60,
      );
    });
  });

  // ─── getStock ─────────────────────────────────────────────────────────

  describe('getStock', () => {
    it('returns cached stock response on cache hit', async () => {
      const cachedResponse = { symbol: 'AAPL', candles: [], quote: {}, analysis: null };
      mockRedisService.get.mockResolvedValueOnce(cachedResponse);

      const result = await service.getStock('AAPL');
      expect(result).toBe(cachedResponse);
    });

    it('throws NotFoundException when no candles found', async () => {
      // stock cache miss, candles cache miss → empty from Yahoo, quote cache miss
      mockRedisService.get.mockResolvedValue(null);
      (yf.chart as jest.Mock).mockResolvedValueOnce({ quotes: [] });
      (yf.quote as jest.Mock).mockResolvedValueOnce({
        symbol: 'FAKE',
        regularMarketPrice: 10,
        regularMarketChange: 0,
        regularMarketChangePercent: 0,
        regularMarketVolume: 0,
        regularMarketOpen: 10,
        regularMarketDayHigh: 10,
        regularMarketDayLow: 10,
        regularMarketPreviousClose: 10,
      });

      await expect(service.getStock('FAKE')).rejects.toThrow(NotFoundException);
    });

    it('includes analysis in response for sufficient candle data', async () => {
      // All Redis lookups miss — use mockResolvedValue (not Once) for robustness
      mockRedisService.get.mockResolvedValue(null);

      (yf.chart as jest.Mock).mockResolvedValueOnce({
        quotes: sampleCandles.map((c) => ({
          date: new Date(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        })),
      });
      (yf.quote as jest.Mock).mockResolvedValueOnce({
        symbol: 'AAPL',
        regularMarketPrice: 120,
        regularMarketChange: 1,
        regularMarketChangePercent: 0.84,
        regularMarketVolume: 1000000,
        regularMarketOpen: 119,
        regularMarketDayHigh: 121,
        regularMarketDayLow: 118,
        regularMarketPreviousClose: 119,
      });

      const result = await service.getStock('AAPL');

      expect(result.symbol).toBe('AAPL');
      expect(result.candles.length).toBeGreaterThan(0);
      expect(result.candles.length).toBeLessThanOrEqual(365);
      // analysis is computed from candles — with 200 candles it should exist
      expect(result.analysis).not.toBeNull();
      expect(result.analysis?.symbol).toBe('AAPL');
    });
  });

  // ─── getNews ──────────────────────────────────────────────────────────

  describe('getNews', () => {
    it('returns cached news on cache hit', async () => {
      const cachedNews = [{ title: 'Test News', url: 'http://test.com' }];
      mockRedisService.get.mockResolvedValueOnce(cachedNews);

      const result = await service.getNews('AAPL');
      expect(result).toBe(cachedNews);
      expect(yf.search).not.toHaveBeenCalled();
    });

    it('fetches news from Yahoo and caches for 1 hour', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.search as jest.Mock).mockResolvedValueOnce({
        news: [
          {
            title: 'Apple announces new product',
            link: 'https://example.com/news/1',
            publisher: 'Reuters',
            providerPublishTime: new Date('2024-01-15T10:00:00Z'),
          },
        ],
      });

      const result = await service.getNews('AAPL', 5);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Apple announces new product');
      expect(result[0].sentiment).toBe('neutral');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'news:AAPL:5',
        expect.any(Array),
        60 * 60,
      );
    });
  });

  // ─── searchSymbols ────────────────────────────────────────────────────

  describe('searchSymbols', () => {
    it('returns cached search results on cache hit', async () => {
      const cached = [{ symbol: 'AAPL', name: 'Apple', region: 'US', type: 'EQUITY' }];
      mockRedisService.get.mockResolvedValueOnce(cached);

      const result = await service.searchSymbols('apple');
      expect(result).toBe(cached);
    });

    it('fetches search results and caches for 5 minutes', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.search as jest.Mock).mockResolvedValueOnce({
        quotes: [
          { symbol: 'AAPL', shortname: 'Apple Inc.', exchDisp: 'NASDAQ', typeDisp: 'Equity' },
        ],
      });

      const result = await service.searchSymbols('apple');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'search:apple',
        expect.any(Array),
        5 * 60,
      );
    });

    it('skips quotes without valid symbol', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.search as jest.Mock).mockResolvedValueOnce({
        quotes: [
          { symbol: '', name: 'Invalid' },
          { symbol: 'NVDA', shortname: 'NVIDIA', exchDisp: 'NASDAQ' },
        ],
      });

      const result = await service.searchSymbols('nv');
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('NVDA');
    });
  });

  // ─── getRecommendations ───────────────────────────────────────────────

  describe('getRecommendations', () => {
    it('returns cached recommendations on cache hit', async () => {
      const cached = [{ symbol: 'NVDA', category: 'TOP_GAINER' }];
      mockRedisService.get.mockResolvedValueOnce(cached);

      const result = await service.getRecommendations();
      expect(result).toBe(cached);
      expect(yf.screener).not.toHaveBeenCalled();
    });

    it('builds recommendation list from screeners', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      const mockGainer = { symbol: 'NVDA', shortName: 'NVIDIA', regularMarketPrice: 500, regularMarketChangePercent: 5 };
      const mockActive = { symbol: 'TSLA', shortName: 'Tesla', regularMarketPrice: 200, regularMarketChangePercent: 2 };
      const mockLoser = { symbol: 'META', shortName: 'Meta', regularMarketPrice: 300, regularMarketChangePercent: -3 };

      (yf.screener as jest.Mock)
        .mockResolvedValueOnce({ quotes: [mockGainer] })
        .mockResolvedValueOnce({ quotes: [mockActive] })
        .mockResolvedValueOnce({ quotes: [mockLoser] });

      const result = await service.getRecommendations();

      expect(result).toHaveLength(3);
      expect(result.find((r) => r.symbol === 'NVDA')?.category).toBe('TOP_GAINER');
      expect(result.find((r) => r.symbol === 'TSLA')?.category).toBe('ACTIVE');
      expect(result.find((r) => r.symbol === 'META')?.category).toBe('TOP_LOSER');
    });

    it('handles screener failures gracefully', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);
      (yf.screener as jest.Mock).mockRejectedValue(new Error('Screener unavailable'));

      const result = await service.getRecommendations();
      expect(result).toEqual([]);
    });
  });
});
