"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.yahooFinance = void 0;
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const yf = new yahoo_finance2_1.default({ suppressNotices: ['yahooSurvey'] });
exports.yahooFinance = yf;
//# sourceMappingURL=yahoo-finance.provider.js.map