import { RedisService } from '../redis/redis.service';
import { Candle, CompanyOverview, NewsItem, Quote, Recommendation, SearchResult, StockResponse } from './types';
export declare class StockService {
    private readonly redis;
    private readonly logger;
    constructor(redis: RedisService);
    getDailyCandles(symbol: string): Promise<Candle[]>;
    getQuote(symbol: string): Promise<Quote>;
    getStock(symbol: string): Promise<StockResponse>;
    getOverview(symbol: string): Promise<CompanyOverview>;
    getNews(symbol: string, limit?: number): Promise<NewsItem[]>;
    searchSymbols(keyword: string): Promise<SearchResult[]>;
    getRecommendations(): Promise<Recommendation[]>;
}
