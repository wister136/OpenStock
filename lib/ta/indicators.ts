export function SMA(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v;
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function EMA(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (prev == null) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prev = sum / period;
      out[i] = prev;
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function RSI(close: number[], period = 14): number[] {
  const out = new Array(close.length).fill(NaN);
  if (close.length < period + 1) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = close[i] - close[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function ATR(high: number[], low: number[], close: number[], period = 14): number[] {
  const out = new Array(close.length).fill(NaN);
  if (close.length < period + 1) return out;

  const tr = new Array(close.length).fill(0);
  for (let i = 1; i < close.length; i++) {
    const h = high[i];
    const l = low[i];
    const pc = close[i - 1];
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  out[period] = sum / period;

  for (let i = period + 1; i < close.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

export function ADX(high: number[], low: number[], close: number[], period = 14): number[] {
  const len = close.length;
  const out = new Array(len).fill(NaN);
  if (len < period + 1) return out;

  const tr = new Array(len).fill(0);
  const pdm = new Array(len).fill(0);
  const mdm = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const h = high[i];
    const l = low[i];
    const pc = close[i - 1];
    const ph = high[i - 1];
    const pl = low[i - 1];

    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

    const up = h - ph;
    const down = pl - l;
    if (up > down && up > 0) pdm[i] = up;
    if (down > up && down > 0) mdm[i] = down;
  }

  const smooth = (src: number[], p: number): number[] => {
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

  const dx = new Array(len).fill(NaN);
  for (let i = period; i < len; i++) {
    const t = trS[i];
    if (t === 0) continue;
    const pdi = (pdmS[i] / t) * 100;
    const mdi = (mdmS[i] / t) * 100;
    const div = pdi + mdi;
    dx[i] = div === 0 ? 0 : (Math.abs(pdi - mdi) / div) * 100;
  }

  for (let i = period * 2 - 1; i < len; i++) {
    if (i === period * 2 - 1) {
      out[i] = dx[i];
    } else {
      const prev = out[i - 1];
      out[i] = (prev * (period - 1) + dx[i]) / period;
    }
  }
  return out;
}
