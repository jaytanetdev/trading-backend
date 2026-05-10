"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let StatsService = class StatsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPopularStocks(query) {
        const { from, to } = query;
        const where = {};
        if (from || to) {
            where.createdAt = {};
            if (from) {
                where.createdAt.gte = new Date(from);
            }
            if (to) {
                const toDate = new Date(to);
                toDate.setUTCHours(23, 59, 59, 999);
                where.createdAt.lte = toDate;
            }
        }
        const events = await this.prisma.watchlistEvent.findMany({ where });
        const symbolMap = new Map();
        for (const event of events) {
            if (!symbolMap.has(event.symbol)) {
                symbolMap.set(event.symbol, { addCount: 0, removeCount: 0 });
            }
            const entry = symbolMap.get(event.symbol);
            if (event.action === 'ADD') {
                entry.addCount++;
            }
            else if (event.action === 'REMOVE') {
                entry.removeCount++;
            }
        }
        const results = Array.from(symbolMap.entries())
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
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StatsService);
//# sourceMappingURL=stats.service.js.map