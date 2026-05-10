import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  watchlistEvent: {
    findMany: jest.fn(),
  },
};

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  // ─── getPopularStocks ──────────────────────────────────────────────────

  describe('getPopularStocks', () => {
    it('returns empty array when no events exist', async () => {
      mockPrismaService.watchlistEvent.findMany.mockResolvedValueOnce([]);

      const result = await service.getPopularStocks({});
      expect(result).toEqual([]);
    });

    it('aggregates ADD and REMOVE counts per symbol', async () => {
      mockPrismaService.watchlistEvent.findMany.mockResolvedValueOnce([
        { id: 1, clientId: 'c1', symbol: 'AAPL', action: 'ADD', createdAt: new Date() },
        { id: 2, clientId: 'c2', symbol: 'AAPL', action: 'ADD', createdAt: new Date() },
        { id: 3, clientId: 'c1', symbol: 'AAPL', action: 'REMOVE', createdAt: new Date() },
        { id: 4, clientId: 'c1', symbol: 'NVDA', action: 'ADD', createdAt: new Date() },
        { id: 5, clientId: 'c2', symbol: 'NVDA', action: 'ADD', createdAt: new Date() },
        { id: 6, clientId: 'c3', symbol: 'NVDA', action: 'ADD', createdAt: new Date() },
      ]);

      const result = await service.getPopularStocks({});

      // NVDA has 3 adds, AAPL has 2 — sorted by addCount descending
      expect(result[0].symbol).toBe('NVDA');
      expect(result[0].addCount).toBe(3);
      expect(result[0].removeCount).toBe(0);
      expect(result[0].netCount).toBe(3);

      expect(result[1].symbol).toBe('AAPL');
      expect(result[1].addCount).toBe(2);
      expect(result[1].removeCount).toBe(1);
      expect(result[1].netCount).toBe(1);
    });

    it('applies date range filter when from/to provided', async () => {
      mockPrismaService.watchlistEvent.findMany.mockResolvedValueOnce([]);

      await service.getPopularStocks({ from: '2024-01-01', to: '2024-12-31' });

      expect(mockPrismaService.watchlistEvent.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: expect.any(Date),
          },
        },
      });
    });

    it('applies only from filter when only from provided', async () => {
      mockPrismaService.watchlistEvent.findMany.mockResolvedValueOnce([]);

      await service.getPopularStocks({ from: '2024-06-01' });

      const call = mockPrismaService.watchlistEvent.findMany.mock.calls[0][0];
      expect(call.where.createdAt.gte).toEqual(new Date('2024-06-01'));
      expect(call.where.createdAt.lte).toBeUndefined();
    });

    it('returns no more than 20 results', async () => {
      const manyEvents = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        clientId: 'c1',
        symbol: `SYM${i}`,
        action: 'ADD',
        createdAt: new Date(),
      }));
      mockPrismaService.watchlistEvent.findMany.mockResolvedValueOnce(manyEvents);

      const result = await service.getPopularStocks({});
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('queries without date filter when no from/to provided', async () => {
      mockPrismaService.watchlistEvent.findMany.mockResolvedValueOnce([]);

      await service.getPopularStocks({});

      expect(mockPrismaService.watchlistEvent.findMany).toHaveBeenCalledWith({
        where: {},
      });
    });
  });
});
