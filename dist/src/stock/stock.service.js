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
var StockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
const analysis_1 = require("./analysis");
const yahoo_finance_provider_1 = require("./yahoo-finance.provider");
const TTL = {
    STOCK: 15 * 60,
    OVERVIEW: 24 * 60 * 60,
    NEWS: 60 * 60,
    SEARCH: 5 * 60,
    RECOMMENDATIONS: 2 * 60 * 60,
};
function num(v) {
    if (v == null)
        return NaN;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : NaN;
}
function pad(n) {
    return n < 10 ? `0${n}` : `${n}`;
}
function toISODate(d) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function toAVTimestamp(d) {
    return (`${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`);
}
let StockService = StockService_1 = class StockService {
    redis;
    logger = new common_1.Logger(StockService_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    async getDailyCandles(symbol) {
        const key = `candles:${symbol}`;
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const result = (await yahoo_finance_provider_1.yahooFinance.chart(symbol, { period1: '1970-01-01', interval: '1d' }, { validateResult: false }));
        const out = [];
        for (const row of result.quotes) {
            if (!row.date)
                continue;
            const close = (row.close ?? row.adjclose);
            if (close == null)
                continue;
            const date = row.date instanceof Date
                ? row.date
                : new Date(row.date);
            out.push({
                time: toISODate(date),
                open: num(row.open),
                high: num(row.high),
                low: num(row.low),
                close: num(close),
                volume: num(row.volume),
            });
        }
        out.sort((a, b) => (a.time < b.time ? -1 : 1));
        await this.redis.set(key, out, TTL.STOCK);
        return out;
    }
    async getQuote(symbol) {
        const key = `quote:${symbol}`;
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const q = await yahoo_finance_provider_1.yahooFinance.quote(symbol, undefined, { validateResult: false });
        if (!q || q.regularMarketPrice == null) {
            throw new common_1.NotFoundException(`Quote not found for ${symbol}`);
        }
        const out = {
            symbol: q.symbol ?? symbol,
            price: num(q.regularMarketPrice),
            change: num(q.regularMarketChange),
            changePercent: num(q.regularMarketChangePercent),
            volume: num(q.regularMarketVolume),
            open: num(q.regularMarketOpen),
            high: num(q.regularMarketDayHigh),
            low: num(q.regularMarketDayLow),
            prevClose: num(q.regularMarketPreviousClose),
        };
        await this.redis.set(key, out, TTL.STOCK);
        return out;
    }
    async getStock(symbol) {
        const key = `stock:${symbol}`;
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const [candles, quote] = await Promise.all([
            this.getDailyCandles(symbol),
            this.getQuote(symbol),
        ]);
        if (!candles.length) {
            throw new common_1.NotFoundException(`No data found for ${symbol}`);
        }
        const analysis = (0, analysis_1.analyzeStock)(candles);
        if (analysis)
            analysis.symbol = symbol;
        const out = {
            symbol,
            candles: candles.slice(-365),
            quote,
            analysis,
        };
        await this.redis.set(key, out, TTL.STOCK);
        return out;
    }
    async getOverview(symbol) {
        const key = `overview:${symbol}`;
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const summary = (await yahoo_finance_provider_1.yahooFinance.quoteSummary(symbol, {
            modules: [
                'assetProfile',
                'summaryDetail',
                'defaultKeyStatistics',
                'financialData',
                'price',
            ],
        }, { validateResult: false }));
        const profile = (summary.assetProfile ?? {});
        const detail = (summary.summaryDetail ?? {});
        const stats = (summary.defaultKeyStatistics ?? {});
        const fin = (summary.financialData ?? {});
        const price = (summary.price ?? {});
        if (!price.symbol && !detail.marketCap) {
            throw new common_1.NotFoundException(`Overview not found for ${symbol}`);
        }
        const pick = (...keys) => {
            for (const { src, key } of keys) {
                const v = src[key];
                if (v != null)
                    return v;
            }
            return undefined;
        };
        const out = {
            symbol: String(price.symbol ?? symbol),
            name: String(price.longName ?? price.shortName ?? symbol),
            description: String(profile.longBusinessSummary ?? ''),
            exchange: String(price.exchangeName ?? price.exchange ?? ''),
            sector: String(profile.sector ?? ''),
            industry: String(profile.industry ?? ''),
            country: String(profile.country ?? ''),
            marketCap: num(pick({ src: price, key: 'marketCap' }, { src: detail, key: 'marketCap' })),
            peRatio: num(pick({ src: detail, key: 'trailingPE' }, { src: stats, key: 'trailingPE' })),
            forwardPE: num(pick({ src: detail, key: 'forwardPE' }, { src: stats, key: 'forwardPE' })),
            pegRatio: num(stats.pegRatio),
            eps: num(pick({ src: stats, key: 'trailingEps' }, { src: fin, key: 'epsTrailingTwelveMonths' })),
            dividendYield: num(detail.dividendYield),
            beta: num(pick({ src: detail, key: 'beta' }, { src: stats, key: 'beta' })),
            fiftyTwoWeekHigh: num(detail.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: num(detail.fiftyTwoWeekLow),
            profitMargin: num(pick({ src: fin, key: 'profitMargins' }, { src: stats, key: 'profitMargins' })),
            roe: num(fin.returnOnEquity),
            revenueGrowthYoY: num(fin.revenueGrowth),
            earningsGrowthYoY: num(fin.earningsGrowth),
            priceToBook: num(pick({ src: detail, key: 'priceToBook' }, { src: stats, key: 'priceToBook' })),
            analystTargetPrice: num(fin.targetMeanPrice),
        };
        await this.redis.set(key, out, TTL.OVERVIEW);
        return out;
    }
    async getNews(symbol, limit = 10) {
        const key = `news:${symbol}:${limit}`;
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const result = (await yahoo_finance_provider_1.yahooFinance.search(symbol, { newsCount: limit, quotesCount: 0 }, { validateResult: false }));
        const out = (result.news ?? []).slice(0, limit).map((n) => {
            const t = n.providerPublishTime;
            const published = t instanceof Date ? t : t ? new Date(t) : new Date();
            return {
                title: n.title ?? '',
                url: n.link ?? '',
                source: n.publisher ?? '',
                publishedAt: toAVTimestamp(published),
                summary: '',
                sentiment: 'neutral',
                sentimentScore: 0,
                banner: n.thumbnail?.resolutions?.[0]?.url,
            };
        });
        await this.redis.set(key, out, TTL.NEWS);
        return out;
    }
    async searchSymbols(keyword) {
        const key = `search:${keyword.toLowerCase()}`;
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const result = (await yahoo_finance_provider_1.yahooFinance.search(keyword, { quotesCount: 10, newsCount: 0 }, { validateResult: false }));
        const out = [];
        for (const q of result.quotes ?? []) {
            const anyQ = q;
            const symbol = anyQ.symbol;
            if (typeof symbol !== 'string' || !symbol)
                continue;
            out.push({
                symbol,
                name: String(anyQ.shortname ?? anyQ.longname ?? anyQ.name ?? symbol),
                region: String(anyQ.exchDisp ?? anyQ.exchange ?? ''),
                type: String(anyQ.typeDisp ?? anyQ.quoteType ?? ''),
            });
        }
        await this.redis.set(key, out, TTL.SEARCH);
        return out;
    }
    async getRecommendations() {
        const key = 'movers';
        const cached = await this.redis.get(key);
        if (cached)
            return cached;
        const runScreener = async (scrId, count) => {
            try {
                const r = await yahoo_finance_provider_1.yahooFinance.screener({ scrIds: scrId, count }, undefined, { validateResult: false });
                const rec = r;
                return (rec.quotes ?? []);
            }
            catch (err) {
                this.logger.warn(`Screener ${scrId} failed: ${String(err)}`);
                return [];
            }
        };
        const [gainers, actives, losers] = await Promise.all([
            runScreener('day_gainers', 5),
            runScreener('most_actives', 5),
            runScreener('day_losers', 3),
        ]);
        const out = [];
        const push = (list, reason, category) => {
            for (const m of list) {
                const symbol = m.symbol;
                if (typeof symbol !== 'string' || !symbol)
                    continue;
                out.push({
                    symbol,
                    name: (typeof m.shortName === 'string' && m.shortName) ||
                        (typeof m.longName === 'string' && m.longName) ||
                        undefined,
                    price: num(m.regularMarketPrice),
                    changePercent: num(m.regularMarketChangePercent),
                    reason,
                    category,
                });
            }
        };
        push(gainers, 'หุ้นที่มีโมเมนตัมขาขึ้นแรงสุดในวันนี้', 'TOP_GAINER');
        push(actives, 'วอลุ่มซื้อขายสูงสุด — สภาพคล่องดี เหมาะกับการเข้า-ออกเร็ว', 'ACTIVE');
        push(losers, 'ปรับฐานแรง — อาจเป็นโอกาสรีบาวน์ทางเทคนิคถ้าพื้นฐานแกร่ง', 'TOP_LOSER');
        await this.redis.set(key, out, TTL.RECOMMENDATIONS);
        return out;
    }
};
exports.StockService = StockService;
exports.StockService = StockService = StockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], StockService);
//# sourceMappingURL=stock.service.js.map