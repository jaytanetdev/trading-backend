import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // GET /stats/popular?from=&to=
  @Get('popular')
  async getPopular(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const items = await this.statsService.getPopularStocks({ from, to });
    return { items };
  }
}
