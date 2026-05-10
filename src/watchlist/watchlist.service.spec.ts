import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  watchlistItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  watchlistEvent: {
    create: jest.fn(),
  },
};

describe('WatchlistService', () => {
  let service: WatchlistService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WatchlistService>(WatchlistService);
  });

  // ─── getWatchlist ──────────────────────────────────────────────────────

  describe('getWatchlist', () => {
    it('returns watchlist items for a client', async () => {
      const items = [
        { id: 1, clientId: 'client-123', symbol: 'AAPL', addedAt: new Date() },
        { id: 2, clientId: 'client-123', symbol: 'NVDA', addedAt: new Date() },
      ];
      mockPrismaService.watchlistItem.findMany.mockResolvedValueOnce(items);

      const result = await service.getWatchlist('client-123');

      expect(result).toBe(items);
      expect(mockPrismaService.watchlistItem.findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-123' },
        orderBy: { addedAt: 'desc' },
      });
    });

    it('returns empty array when client has no watchlist items', async () => {
      mockPrismaService.watchlistItem.findMany.mockResolvedValueOnce([]);

      const result = await service.getWatchlist('client-new');
      expect(result).toEqual([]);
    });
  });

  // ─── addToWatchlist ────────────────────────────────────────────────────

  describe('addToWatchlist', () => {
    it('adds item to watchlist and records ADD event', async () => {
      const newItem = { id: 1, clientId: 'client-123', symbol: 'AAPL', addedAt: new Date() };
      mockPrismaService.watchlistItem.create.mockResolvedValueOnce(newItem);
      mockPrismaService.watchlistEvent.create.mockResolvedValueOnce({});

      const result = await service.addToWatchlist('client-123', 'aapl');

      expect(result).toBe(newItem);
      expect(mockPrismaService.watchlistItem.create).toHaveBeenCalledWith({
        data: { clientId: 'client-123', symbol: 'AAPL' },
      });
      expect(mockPrismaService.watchlistEvent.create).toHaveBeenCalledWith({
        data: { clientId: 'client-123', symbol: 'AAPL', action: 'ADD' },
      });
    });

    it('uppercases symbol before saving', async () => {
      const newItem = { id: 1, clientId: 'c1', symbol: 'TSLA', addedAt: new Date() };
      mockPrismaService.watchlistItem.create.mockResolvedValueOnce(newItem);
      mockPrismaService.watchlistEvent.create.mockResolvedValueOnce({});

      await service.addToWatchlist('c1', 'tsla');

      expect(mockPrismaService.watchlistItem.create).toHaveBeenCalledWith({
        data: { clientId: 'c1', symbol: 'TSLA' },
      });
    });

    it('throws ConflictException on duplicate entry', async () => {
      const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      mockPrismaService.watchlistItem.create.mockRejectedValueOnce(prismaError);

      await expect(service.addToWatchlist('client-123', 'AAPL')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── removeFromWatchlist ───────────────────────────────────────────────

  describe('removeFromWatchlist', () => {
    it('removes item and records REMOVE event', async () => {
      const existing = { id: 1, clientId: 'client-123', symbol: 'AAPL', addedAt: new Date() };
      mockPrismaService.watchlistItem.findUnique.mockResolvedValueOnce(existing);
      mockPrismaService.watchlistItem.delete.mockResolvedValueOnce(existing);
      mockPrismaService.watchlistEvent.create.mockResolvedValueOnce({});

      const result = await service.removeFromWatchlist('client-123', 'aapl');

      expect(result).toEqual({ message: 'AAPL removed from watchlist' });
      expect(mockPrismaService.watchlistItem.delete).toHaveBeenCalledWith({
        where: { clientId_symbol: { clientId: 'client-123', symbol: 'AAPL' } },
      });
      expect(mockPrismaService.watchlistEvent.create).toHaveBeenCalledWith({
        data: { clientId: 'client-123', symbol: 'AAPL', action: 'REMOVE' },
      });
    });

    it('throws NotFoundException when item does not exist', async () => {
      mockPrismaService.watchlistItem.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.removeFromWatchlist('client-123', 'FAKE'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
