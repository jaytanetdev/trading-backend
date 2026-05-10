import { PrismaService } from '../prisma/prisma.service';
export interface PopularStock {
    symbol: string;
    addCount: number;
    removeCount: number;
    netCount: number;
}
export interface PopularStocksQuery {
    from?: string;
    to?: string;
}
export declare class StatsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPopularStocks(query: PopularStocksQuery): Promise<PopularStock[]>;
}
