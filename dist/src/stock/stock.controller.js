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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockController = void 0;
const common_1 = require("@nestjs/common");
const stock_service_1 = require("./stock.service");
let StockController = class StockController {
    stockService;
    constructor(stockService) {
        this.stockService = stockService;
    }
    async getStock(symbol) {
        const upper = symbol.toUpperCase();
        try {
            return await this.stockService.getStock(upper);
        }
        catch (err) {
            if (err instanceof common_1.NotFoundException)
                throw err;
            throw new common_1.NotFoundException(err instanceof Error ? err.message : String(err));
        }
    }
    async getOverview(symbol) {
        const upper = symbol.toUpperCase();
        try {
            return await this.stockService.getOverview(upper);
        }
        catch (err) {
            if (err instanceof common_1.NotFoundException)
                throw err;
            throw new common_1.NotFoundException(err instanceof Error ? err.message : String(err));
        }
    }
    async getNews(symbol, limit) {
        const upper = symbol.toUpperCase();
        const lim = limit ? parseInt(limit, 10) : 10;
        const items = await this.stockService.getNews(upper, lim);
        return { items };
    }
    async search(q) {
        if (!q || q.length < 1)
            return { items: [] };
        const items = await this.stockService.searchSymbols(q);
        return { items: items.slice(0, 10) };
    }
    async getRecommendations() {
        const items = await this.stockService.getRecommendations();
        return { items };
    }
};
exports.StockController = StockController;
__decorate([
    (0, common_1.Get)('stock/:symbol'),
    __param(0, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getStock", null);
__decorate([
    (0, common_1.Get)('stock/:symbol/overview'),
    __param(0, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('stock/:symbol/news'),
    __param(0, (0, common_1.Param)('symbol')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getNews", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StockController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StockController.prototype, "getRecommendations", null);
exports.StockController = StockController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [stock_service_1.StockService])
], StockController);
//# sourceMappingURL=stock.controller.js.map