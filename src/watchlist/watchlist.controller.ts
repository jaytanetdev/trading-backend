import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { WatchlistService } from './watchlist.service';

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  // GET /watchlist/:clientId
  @Get(':clientId')
  async getWatchlist(@Param('clientId') clientId: string) {
    const items = await this.watchlistService.getWatchlist(clientId);
    return { items };
  }

  // POST /watchlist/:clientId/:symbol
  @Post(':clientId/:symbol')
  @HttpCode(HttpStatus.CREATED)
  async addToWatchlist(
    @Param('clientId') clientId: string,
    @Param('symbol') symbol: string,
  ) {
    return this.watchlistService.addToWatchlist(clientId, symbol);
  }

  // DELETE /watchlist/:clientId/:symbol
  @Delete(':clientId/:symbol')
  async removeFromWatchlist(
    @Param('clientId') clientId: string,
    @Param('symbol') symbol: string,
  ) {
    return this.watchlistService.removeFromWatchlist(clientId, symbol);
  }
}
