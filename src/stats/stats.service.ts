import { Injectable } from '@nestjs/common';
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

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPopularStocks(query: PopularStocksQuery): Promise<PopularStock[]> {
    const { from, to } = query;

    const where: {
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        // Include the entire "to" day by setting time to end of day
        const toDate = new Date(to);
        toDate.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const events = await this.prisma.watchlistEvent.findMany({ where });

    // Aggregate counts per symbol
    const symbolMap = new Map<
      string,
      { addCount: number; removeCount: number }
    >();

    for (const event of events) {
      if (!symbolMap.has(event.symbol)) {
        symbolMap.set(event.symbol, { addCount: 0, removeCount: 0 });
      }
      const entry = symbolMap.get(event.symbol)!;
      if (event.action === 'ADD') {
        entry.addCount++;
      } else if (event.action === 'REMOVE') {
        entry.removeCount++;
      }
    }

    const results: PopularStock[] = Array.from(symbolMap.entries())
      .map(([symbol, counts]) => ({
        symbol,
        addCount: counts.addCount,
        removeCount: counts.removeCount,
        netCount: counts.addCount - counts.removeCount,
      }))
      .sort((a, b) => b.addCount - a.addCount)
      .slice(0, 20);

    return results;
  }
}
