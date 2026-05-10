import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { StockService } from './stock.service';

@Controller()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // GET /stock/:symbol
  @Get('stock/:symbol')
  async getStock(@Param('symbol') symbol: string) {
    const upper = symbol.toUpperCase();
    try {
      return await this.stockService.getStock(upper);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // GET /stock/:symbol/overview
  @Get('stock/:symbol/overview')
  async getOverview(@Param('symbol') symbol: string) {
    const upper = symbol.toUpperCase();
    try {
      return await this.stockService.getOverview(upper);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // GET /stock/:symbol/news
  @Get('stock/:symbol/news')
  async getNews(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: string,
  ) {
    const upper = symbol.toUpperCase();
    const lim = limit ? parseInt(limit, 10) : 10;
    const items = await this.stockService.getNews(upper, lim);
    return { items };
  }

  // GET /search?q=
  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || q.length < 1) return { items: [] };
    const items = await this.stockService.searchSymbols(q);
    return { items: items.slice(0, 10) };
  }

  // GET /recommendations
  @Get('recommendations')
  async getRecommendations() {
    const items = await this.stockService.getRecommendations();
    return { items };
  }
}
