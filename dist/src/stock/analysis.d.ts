import { Candle, IndicatorSnapshot, StockAnalysis } from './types';
export declare function buildIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot;
export declare function analyzeStock(candles: Candle[]): StockAnalysis | null;
