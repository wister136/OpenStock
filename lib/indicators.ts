export type OHLCVBar = {
  t: number; // epoch seconds
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period + 1) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function lastFinite(arr: number[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (Number.isFinite(v)) return v;
  }
  return null;
}


export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length === 0) return out;
  const k = 2 / (period + 1);
  let prevEma: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (prevEma == null) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prevEma = sum / period;
      out[i] = prevEma;
      continue;
    }
    prevEma = v * k + prevEma * (1 - k);
    out[i] = prevEma;
  }
  return out;
}

export function rollingStd(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 1) return out;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    const win = values.slice(i - period + 1, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / period;
    const varSum = win.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    out[i] = Math.sqrt(varSum / period);
  }
  return out;
}

export function bollingerBands(values: number[], period = 20, mult = 2): { mid: number[]; upper: number[]; lower: number[] } {
  const mid = sma(values, period);
  const sd = rollingStd(values, period);
  const upper = mid.map((m, i) => (Number.isFinite(m) && Number.isFinite(sd[i]) ? m + mult * sd[i] : NaN));
  const lower = mid.map((m, i) => (Number.isFinite(m) && Number.isFinite(sd[i]) ? m - mult * sd[i] : NaN));
  return { mid, upper, lower };
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; hist: number[] } {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine: number[] = values.map((_, i) => (Number.isFinite(fastEma[i]) && Number.isFinite(slowEma[i]) ? fastEma[i] - slowEma[i] : NaN));
  const signalLine = ema(macdLine.map((v) => (Number.isFinite(v) ? v : NaN)), signal);
  const hist = macdLine.map((m, i) => (Number.isFinite(m) && Number.isFinite(signalLine[i]) ? m - signalLine[i] : NaN));
  return { macd: macdLine, signal: signalLine, hist };
}

export function rollingMax(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0) return out;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    let mx = -Infinity;
    for (let j = i - period + 1; j <= i; j++) mx = Math.max(mx, values[j]);
    out[i] = mx;
  }
  return out;
}

export function rollingMin(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (period <= 0) return out;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    let mn = Infinity;
    for (let j = i - period + 1; j <= i; j++) mn = Math.min(mn, values[j]);
    out[i] = mn;
  }
  return out;
}

// === 在文件末尾追加以下代码 ===
// 计算 ADX (趋势强度)
export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number[]; pdi: number[]; mdi: number[] } {
  const len = closes.length;
  const outAdx = new Array(len).fill(NaN);
  const outPdi = new Array(len).fill(NaN);
  const outMdi = new Array(len).fill(NaN);

  if (len < period + 1) return { adx: outAdx, pdi: outPdi, mdi: outMdi };

  const tr = new Array(len).fill(0);
  const pdm = new Array(len).fill(0);
  const mdm = new Array(len).fill(0);

  // 1. Calculate TR, +DM, -DM
  for (let i = 1; i < len; i++) {
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    const ph = highs[i - 1];
    const pl = lows[i - 1];

    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

    const up = h - ph;
    const down = pl - l;

    if (up > down && up > 0) pdm[i] = up;
    if (down > up && down > 0) mdm[i] = down;
  }

  // 2. Wilder's Smoothing
  const smooth = (src: number[], p: number) => {
    const res = new Array(src.length).fill(0);
    let sum = 0;
    for (let i = 1; i <= p; i++) sum += src[i];
    res[p] = sum;
    let val = sum;
    for (let i = p + 1; i < src.length; i++) {
      val = val - val / p + src[i];
      res[i] = val;
    }
    return res;
  };

  const trS = smooth(tr, period);
  const pdmS = smooth(pdm, period);
  const mdmS = smooth(mdm, period);

  // 3. Calculate +DI, -DI, DX, ADX
  for (let i = period; i < len; i++) {
    const t = trS[i];
    if (t === 0) continue;

    const pdi = (pdmS[i] / t) * 100;
    const mdi = (mdmS[i] / t) * 100;
    outPdi[i] = pdi;
    outMdi[i] = mdi;

    const div = pdi + mdi;
    const dx = div === 0 ? 0 : (Math.abs(pdi - mdi) / div) * 100;

    if (i === period * 2 - 1) {
      outAdx[i] = dx;
    } else if (i >= period * 2) {
      const prev = outAdx[i - 1];
      if (Number.isFinite(prev)) {
        outAdx[i] = (prev * (period - 1) + dx) / period;
      } else {
        outAdx[i] = dx;
      }
    }
  }

  return { adx: outAdx, pdi: outPdi, mdi: outMdi };
}

// 计算 ATR (波动率)
export function atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const len = closes.length;
  const out = new Array(len).fill(NaN);
  if (len < period + 1) return out;

  const tr = new Array(len).fill(0);
  for (let i = 1; i < len; i++) {
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  out[period] = sum / period;

  for (let i = period + 1; i < len; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}