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
exports.WatchlistController = void 0;
const common_1 = require("@nestjs/common");
const watchlist_service_1 = require("./watchlist.service");
let WatchlistController = class WatchlistController {
    watchlistService;
    constructor(watchlistService) {
        this.watchlistService = watchlistService;
    }
    async getWatchlist(clientId) {
        const items = await this.watchlistService.getWatchlist(clientId);
        return { items };
    }
    async addToWatchlist(clientId, symbol) {
        return this.watchlistService.addToWatchlist(clientId, symbol);
    }
    async removeFromWatchlist(clientId, symbol) {
        return this.watchlistService.removeFromWatchlist(clientId, symbol);
    }
};
exports.WatchlistController = WatchlistController;
__decorate([
    (0, common_1.Get)(':clientId'),
    __param(0, (0, common_1.Param)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WatchlistController.prototype, "getWatchlist", null);
__decorate([
    (0, common_1.Post)(':clientId/:symbol'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Param)('clientId')),
    __param(1, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WatchlistController.prototype, "addToWatchlist", null);
__decorate([
    (0, common_1.Delete)(':clientId/:symbol'),
    __param(0, (0, common_1.Param)('clientId')),
    __param(1, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WatchlistController.prototype, "removeFromWatchlist", null);
exports.WatchlistController = WatchlistController = __decorate([
    (0, common_1.Controller)('watchlist'),
    __metadata("design:paramtypes", [watchlist_service_1.WatchlistService])
], WatchlistController);
//# sourceMappingURL=watchlist.controller.js.map