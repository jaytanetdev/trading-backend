import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WatchlistItem } from '@prisma/client';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async getWatchlist(clientId: string): Promise<WatchlistItem[]> {
    return this.prisma.watchlistItem.findMany({
      where: { clientId },
      orderBy: { addedAt: 'desc' },
    });
  }

  async addToWatchlist(
    clientId: string,
    symbol: string,
  ): Promise<WatchlistItem> {
    const upper = symbol.toUpperCase();

    try {
      const item = await this.prisma.watchlistItem.create({
        data: { clientId, symbol: upper },
      });

      // Record the event
      await this.prisma.watchlistEvent.create({
        data: { clientId, symbol: upper, action: 'ADD' },
      });

      return item;
    } catch (err: unknown) {
      // Prisma unique constraint violation
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `${upper} is already in watchlist for this client`,
        );
      }
      throw err;
    }
  }

  async removeFromWatchlist(
    clientId: string,
    symbol: string,
  ): Promise<{ message: string }> {
    const upper = symbol.toUpperCase();

    const existing = await this.prisma.watchlistItem.findUnique({
      where: { clientId_symbol: { clientId, symbol: upper } },
    });

    if (!existing) {
      throw new NotFoundException(`${upper} not found in watchlist`);
    }

    await this.prisma.watchlistItem.delete({
      where: { clientId_symbol: { clientId, symbol: upper } },
    });

    // Record the event
    await this.prisma.watchlistEvent.create({
      data: { clientId, symbol: upper, action: 'REMOVE' },
    });

    return { message: `${upper} removed from watchlist` };
  }
}
