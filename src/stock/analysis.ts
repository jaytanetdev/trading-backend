import {
  AnalysisReason,
  Candle,
  IndicatorSnapshot,
  Signal,
  StockAnalysis,
  SupportResistance,
} from './types';

// ─── Indicator Math ────────────────────────────────────────────────────────

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sum += values[i];
      out.push(null);
    } else if (i === period - 1) {
      sum += values[i];
      prev = sum / period;
      out.push(prev);
    } else {
      prev = values[i] * k + (prev as number) * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (i <= period) {
      if (diff > 0) gain += diff;
      else loss -= diff;
      if (i === period) {
        const avgGain = gain / period;
        const avgLoss = loss / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else {
        out.push(null);
      }
    } else {
      const prevAvgGain =
        ((gain / period) * (period - 1)) / period +
        (diff > 0 ? diff / period : 0);
      const prevAvgLoss =
        ((loss / period) * (period - 1)) / period +
        (diff < 0 ? -diff / period : 0);
      gain = prevAvgGain * period;
      loss = prevAvgLoss * period;
      const rs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = emaFast.map((v, i) => {
    const s = emaSlow[i];
    return v !== null && s !== null ? v - s : null;
  });
  const cleaned = macdLine.map((v) => (v === null ? 0 : v));
  const signalLine = ema(cleaned, signal).map((v, i) =>
    macdLine[i] === null ? null : v,
  );
  const hist = macdLine.map((m, i) => {
    const s = signalLine[i];
    return m !== null && s !== null ? m - s : null;
  });
  return { macdLine, signalLine, hist };
}

function bollinger(values: number[], period = 20, stdDev = 2) {
  const middle = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;
    const variance =
      slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + stdDev * sd);
    lower.push(mean - stdDev * sd);
  }
  return { upper, middle, lower };
}

function atr(candles: Candle[], period = 14): (number | null)[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const prev = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev),
      Math.abs(candles[i].low - prev),
    );
    trs.push(tr);
  }
  return ema(trs, period);
}

function pivotPoints(candle: Candle): SupportResistance {
  const { high, low, close } = candle;
  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  return { support: [], resistance: [], pivot, r1, r2, s1, s2 };
}

function detectSupportResistance(
  candles: Candle[],
  lookback = 5,
  clusterTolerancePct = 0.015,
): { support: number[]; resistance: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high) isHigh = false;
      if (candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low) isLow = false;
      if (candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) highs.push(candles[i].high);
    if (isLow) lows.push(candles[i].low);
  }

  const cluster = (levels: number[]): number[] => {
    if (!levels.length) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const out: number[] = [];
    let bucket: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const avg = bucket.reduce((a, b) => a + b, 0) / bucket.length;
      if (Math.abs(sorted[i] - avg) / avg <= clusterTolerancePct) {
        bucket.push(sorted[i]);
      } else {
        out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length);
        bucket = [sorted[i]];
      }
    }
    out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length);
    return out;
  };

  const lastPrice = candles[candles.length - 1].close;
  const supportLevels = cluster(lows)
    .filter((l) => l < lastPrice)
    .slice(-3);
  const resistanceLevels = cluster(highs)
    .filter((l) => l > lastPrice)
    .slice(0, 3);
  return { support: supportLevels, resistance: resistanceLevels };
}

export function buildIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const lastIdx = closes.length - 1;
  const rsiArr = rsi(closes, 14);
  const macdRes = macd(closes);
  const sma20Arr = sma(closes, 20);
  const sma50Arr = sma(closes, 50);
  const sma200Arr = sma(closes, 200);
  const ema12Arr = ema(closes, 12);
  const ema26Arr = ema(closes, 26);
  const bb = bollinger(closes, 20, 2);
  const atrArr = atr(candles, 14);

  return {
    rsi: rsiArr[lastIdx],
    macd: macdRes.macdLine[lastIdx],
    macdSignal: macdRes.signalLine[lastIdx],
    macdHist: macdRes.hist[lastIdx],
    sma20: sma20Arr[lastIdx],
    sma50: sma50Arr[lastIdx],
    sma200: sma200Arr[lastIdx],
    ema12: ema12Arr[lastIdx],
    ema26: ema26Arr[lastIdx],
    bollingerUpper: bb.upper[lastIdx],
    bollingerMiddle: bb.middle[lastIdx],
    bollingerLower: bb.lower[lastIdx],
    atr: atrArr[lastIdx],
  };
}

export function analyzeStock(candles: Candle[]): StockAnalysis | null {
  if (candles.length < 50) return null;

  const last = candles[candles.length - 1];
  const indicators = buildIndicatorSnapshot(candles);
  const sr = detectSupportResistance(candles);
  const pivot = pivotPoints(candles[candles.length - 2] ?? last);
  const supportResistance: SupportResistance = {
    ...pivot,
    support: sr.support,
    resistance: sr.resistance,
  };

  const reasons: AnalysisReason[] = [];
  let score = 0;
  let weight = 0;

  // RSI
  if (indicators.rsi !== null) {
    weight += 1;
    if (indicators.rsi < 30) {
      score += 1;
      reasons.push({
        text: `RSI ${indicators.rsi.toFixed(1)} อยู่ในเขต Oversold — มักรีบาวน์ในระยะสั้น`,
        type: 'bull',
      });
    } else if (indicators.rsi > 70) {
      score -= 1;
      reasons.push({
        text: `RSI ${indicators.rsi.toFixed(1)} อยู่ในเขต Overbought — เสี่ยงพักฐาน`,
        type: 'bear',
      });
    } else if (indicators.rsi > 50) {
      score += 0.3;
      reasons.push({
        text: `RSI ${indicators.rsi.toFixed(1)} เหนือ 50 บอกถึงโมเมนตัมขาขึ้น`,
        type: 'bull',
      });
    } else {
      score -= 0.3;
      reasons.push({
        text: `RSI ${indicators.rsi.toFixed(1)} ต่ำกว่า 50 โมเมนตัมยังอ่อน`,
        type: 'bear',
      });
    }
  }

  // MACD
  if (indicators.macd !== null && indicators.macdSignal !== null) {
    weight += 1;
    const diff = indicators.macd - indicators.macdSignal;
    if (diff > 0 && (indicators.macdHist ?? 0) > 0) {
      score += 0.8;
      reasons.push({
        text: 'MACD ตัดเส้นสัญญาณขึ้น (Bullish Crossover)',
        type: 'bull',
      });
    } else if (diff < 0) {
      score -= 0.8;
      reasons.push({ text: 'MACD ต่ำกว่าเส้นสัญญาณ — ขาลง', type: 'bear' });
    }
  }

  // Moving averages
  if (indicators.sma50 !== null && indicators.sma200 !== null) {
    weight += 1;
    if (indicators.sma50 > indicators.sma200) {
      score += 0.7;
      reasons.push({
        text: 'SMA50 อยู่เหนือ SMA200 (Golden Cross context) — แนวโน้มหลักเป็นขาขึ้น',
        type: 'bull',
      });
    } else {
      score -= 0.7;
      reasons.push({
        text: 'SMA50 อยู่ใต้ SMA200 (Death Cross context) — แนวโน้มหลักเป็นขาลง',
        type: 'bear',
      });
    }
  }

  if (indicators.sma20 !== null) {
    weight += 0.5;
    if (last.close > indicators.sma20) {
      score += 0.3;
      reasons.push({
        text: `ราคายืนเหนือ SMA20 (${indicators.sma20.toFixed(2)})`,
        type: 'bull',
      });
    } else {
      score -= 0.3;
      reasons.push({
        text: `ราคาอยู่ใต้ SMA20 (${indicators.sma20.toFixed(2)})`,
        type: 'bear',
      });
    }
  }

  // Bollinger
  if (indicators.bollingerUpper !== null && indicators.bollingerLower !== null) {
    weight += 0.5;
    if (last.close <= indicators.bollingerLower) {
      score += 0.5;
      reasons.push({
        text: 'ราคาแตะ Lower Bollinger Band — มักรีบาวน์',
        type: 'bull',
      });
    } else if (last.close >= indicators.bollingerUpper) {
      score -= 0.5;
      reasons.push({
        text: 'ราคาแตะ Upper Bollinger Band — เสี่ยงย่อตัว',
        type: 'bear',
      });
    }
  }

  // Trend confirmation
  const recent = candles.slice(-20);
  const firstHalfAvg =
    recent.slice(0, 10).reduce((a, c) => a + c.close, 0) / 10;
  const secondHalfAvg =
    recent.slice(10).reduce((a, c) => a + c.close, 0) / 10;
  weight += 0.5;
  if (secondHalfAvg > firstHalfAvg * 1.02) {
    score += 0.4;
    reasons.push({
      text: 'ราคาเฉลี่ย 10 วันล่าสุดสูงกว่า 10 วันก่อนหน้า > 2% — มีโมเมนตัมขาขึ้น',
      type: 'bull',
    });
  } else if (secondHalfAvg < firstHalfAvg * 0.98) {
    score -= 0.4;
    reasons.push({
      text: 'ราคาเฉลี่ย 10 วันล่าสุดต่ำกว่า 10 วันก่อนหน้า > 2% — โมเมนตัมขาลง',
      type: 'bear',
    });
  }

  const normalized = weight === 0 ? 0 : score / weight;

  let signal: Signal = 'HOLD';
  if (normalized >= 0.55) signal = 'STRONG_BUY';
  else if (normalized >= 0.2) signal = 'BUY';
  else if (normalized <= -0.55) signal = 'STRONG_SELL';
  else if (normalized <= -0.2) signal = 'SELL';

  const atr14 = indicators.atr ?? last.close * 0.02;
  const nearestSupport =
    sr.support[sr.support.length - 1] ?? last.close - atr14 * 2;
  const nearestResistance = sr.resistance[0] ?? last.close + atr14 * 2;

  let entry = last.close;
  let stopLoss = nearestSupport - atr14 * 0.5;
  let targets = [nearestResistance, nearestResistance + atr14 * 2];

  if (signal === 'STRONG_BUY' || signal === 'BUY') {
    entry = Math.max(nearestSupport, last.close - atr14 * 0.5);
    stopLoss = nearestSupport - atr14;
    targets = [
      last.close + atr14 * 2,
      nearestResistance,
      nearestResistance + atr14 * 2,
    ];
  } else if (signal === 'STRONG_SELL' || signal === 'SELL') {
    entry = Math.min(nearestResistance, last.close + atr14 * 0.5);
    stopLoss = nearestResistance + atr14;
    targets = [
      last.close - atr14 * 2,
      nearestSupport,
      nearestSupport - atr14 * 2,
    ];
  }

  const reward = Math.abs(targets[0] - entry);
  const risk = Math.abs(entry - stopLoss);
  const riskReward = risk === 0 ? 0 : reward / risk;

  return {
    symbol: '',
    signal,
    score: normalized,
    confidence: Math.min(1, Math.abs(normalized) * 1.5),
    reasons,
    entry,
    stopLoss,
    targets,
    riskReward,
    supportResistance,
    indicators,
  };
}
