import { WatchlistService } from './watchlist.service';
export declare class WatchlistController {
    private readonly watchlistService;
    constructor(watchlistService: WatchlistService);
    getWatchlist(clientId: string): Promise<{
        items: {
            symbol: string;
            id: number;
            clientId: string;
            addedAt: Date;
        }[];
    }>;
    addToWatchlist(clientId: string, symbol: string): Promise<{
        symbol: string;
        id: number;
        clientId: string;
        addedAt: Date;
    }>;
    removeFromWatchlist(clientId: string, symbol: string): Promise<{
        message: string;
    }>;
}
