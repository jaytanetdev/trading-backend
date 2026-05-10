export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  exchange: string;
  sector: string;
  industry: string;
  country: string;
  marketCap: number;
  peRatio: number;
  forwardPE: number;
  pegRatio: number;
  eps: number;
  dividendYield: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  profitMargin: number;
  roe: number;
  revenueGrowthYoY: number;
  earningsGrowthYoY: number;
  priceToBook: number;
  analystTargetPrice: number;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  banner?: string;
}

export interface SearchResult {
  symbol: string;
  name: string;
  region: string;
  type: string;
}

export interface Recommendation {
  symbol: string;
  name?: string;
  price: number;
  changePercent: number;
  reason: string;
  category: 'TOP_GAINER' | 'TOP_LOSER' | 'ACTIVE' | 'MOMENTUM';
}

export interface SupportResistance {
  support: number[];
  resistance: number[];
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface IndicatorSnapshot {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema12: number | null;
  ema26: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  atr: number | null;
}

export type Signal = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export interface AnalysisReason {
  text: string;
  type: 'bull' | 'bear' | 'neutral';
}

export interface StockAnalysis {
  symbol: string;
  signal: Signal;
  score: number;
  confidence: number;
  reasons: AnalysisReason[];
  entry: number;
  stopLoss: number;
  targets: number[];
  riskReward: number;
  supportResistance: SupportResistance;
  indicators: IndicatorSnapshot;
}

export interface StockResponse {
  symbol: string;
  candles: Candle[];
  quote: Quote;
  analysis: StockAnalysis | null;
}
