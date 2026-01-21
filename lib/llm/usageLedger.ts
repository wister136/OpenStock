import UsageLedger from '@/database/models/UsageLedger';
import { connectToDatabase } from '@/database/mongoose';

export type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  calls: number;
  costRmb: number;
};

export type BudgetStatus = {
  allowed: boolean;
  reason?: string;
  totals: UsageTotals;
  limits: { budgetRmb: number; inputTokensMax: number; outputTokensMax: number };
};

const DEFAULT_DAILY_BUDGET_RMB = 3.0;
const DEFAULT_INPUT_TOKENS_MAX = 300_000;
const DEFAULT_OUTPUT_TOKENS_MAX = 100_000;
const DEFAULT_INPUT_COST_RMB_PER_1K = 0.002;
const DEFAULT_OUTPUT_COST_RMB_PER_1K = 0.006;

export function getDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function estimateCostRmb(inputTokens: number, outputTokens: number): number {
  const inputRate = Number(process.env.DEEPSEEK_INPUT_COST_RMB_PER_1K ?? DEFAULT_INPUT_COST_RMB_PER_1K);
  const outputRate = Number(process.env.DEEPSEEK_OUTPUT_COST_RMB_PER_1K ?? DEFAULT_OUTPUT_COST_RMB_PER_1K);
  const safeInputRate = Number.isFinite(inputRate) ? inputRate : DEFAULT_INPUT_COST_RMB_PER_1K;
  const safeOutputRate = Number.isFinite(outputRate) ? outputRate : DEFAULT_OUTPUT_COST_RMB_PER_1K;
  return (inputTokens / 1000) * safeInputRate + (outputTokens / 1000) * safeOutputRate;
}

export async function getUsageTotals(dateKey: string): Promise<UsageTotals> {
  await connectToDatabase();
  const rows = await UsageLedger.find({ date: dateKey }).lean();
  return rows.reduce(
    (acc, row: any) => {
      acc.inputTokens += Number(row.inputTokens || 0);
      acc.outputTokens += Number(row.outputTokens || 0);
      acc.calls += Number(row.calls || 0);
      acc.costRmb += Number(row.costRmb || 0);
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, calls: 0, costRmb: 0 }
  );
}

export async function checkBudget(): Promise<BudgetStatus> {
  const budgetRmbRaw = Number(process.env.DAILY_BUDGET_RMB ?? DEFAULT_DAILY_BUDGET_RMB);
  const inputMaxRaw = Number(process.env.DAILY_INPUT_TOKENS_MAX ?? DEFAULT_INPUT_TOKENS_MAX);
  const outputMaxRaw = Number(process.env.DAILY_OUTPUT_TOKENS_MAX ?? DEFAULT_OUTPUT_TOKENS_MAX);
  const budgetRmb = Number.isFinite(budgetRmbRaw) ? budgetRmbRaw : DEFAULT_DAILY_BUDGET_RMB;
  const inputTokensMax = Number.isFinite(inputMaxRaw) ? inputMaxRaw : DEFAULT_INPUT_TOKENS_MAX;
  const outputTokensMax = Number.isFinite(outputMaxRaw) ? outputMaxRaw : DEFAULT_OUTPUT_TOKENS_MAX;

  const totals = await getUsageTotals(getDateKey());
  if (totals.costRmb >= budgetRmb) {
    return { allowed: false, reason: 'budget_exceeded', totals, limits: { budgetRmb, inputTokensMax, outputTokensMax } };
  }
  if (totals.inputTokens >= inputTokensMax) {
    return { allowed: false, reason: 'input_tokens_exceeded', totals, limits: { budgetRmb, inputTokensMax, outputTokensMax } };
  }
  if (totals.outputTokens >= outputTokensMax) {
    return { allowed: false, reason: 'output_tokens_exceeded', totals, limits: { budgetRmb, inputTokensMax, outputTokensMax } };
  }

  return { allowed: true, totals, limits: { budgetRmb, inputTokensMax, outputTokensMax } };
}

export async function recordUsage(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costRmb?: number;
  provider?: 'deepseek';
}): Promise<void> {
  const date = getDateKey();
  const provider = params.provider ?? 'deepseek';
  const inputTokens = Math.max(0, Math.floor(params.inputTokens || 0));
  const outputTokens = Math.max(0, Math.floor(params.outputTokens || 0));
  const costRmb =
    typeof params.costRmb === 'number' && Number.isFinite(params.costRmb)
      ? params.costRmb
      : estimateCostRmb(inputTokens, outputTokens);

  await connectToDatabase();
  await UsageLedger.updateOne(
    { date, model: params.model, provider },
    {
      $inc: {
        inputTokens,
        outputTokens,
        calls: 1,
        costRmb,
      },
      $set: { updatedAt: Date.now() },
    },
    { upsert: true }
  );
}
