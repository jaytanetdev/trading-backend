import { StatsService } from './stats.service';
export declare class StatsController {
    private readonly statsService;
    constructor(statsService: StatsService);
    getPopular(from?: string, to?: string): Promise<{
        items: import("./stats.service").PopularStock[];
    }>;
}
