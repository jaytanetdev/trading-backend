import { StockService } from './stock.service';
export declare class StockController {
    private readonly stockService;
    constructor(stockService: StockService);
    getStock(symbol: string): Promise<import("./types").StockResponse>;
    getOverview(symbol: string): Promise<import("./types").CompanyOverview>;
    getNews(symbol: string, limit?: string): Promise<{
        items: import("./types").NewsItem[];
    }>;
    search(q: string): Promise<{
        items: import("./types").SearchResult[];
    }>;
    getRecommendations(): Promise<{
        items: import("./types").Recommendation[];
    }>;
}
