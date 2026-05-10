import { PrismaService } from '../prisma/prisma.service';
import { WatchlistItem } from '@prisma/client';
export declare class WatchlistService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getWatchlist(clientId: string): Promise<WatchlistItem[]>;
    addToWatchlist(clientId: string, symbol: string): Promise<WatchlistItem>;
    removeFromWatchlist(clientId: string, symbol: string): Promise<{
        message: string;
    }>;
}
