import Link from 'next/link';

import { getSimpleQuote } from '@/lib/actions/quotes.actions';
import { tServer } from '@/lib/i18n/server';

type Row = {
  symbol: string;
  label: string;
  name?: string;
};

function formatNumber(n: number | null, digits = 2): string {
  if (n == null) return '--';
  return n.toFixed(digits);
}

export default async function InternalQuotesTable({ rows }: { rows: Row[] }) {
  const quotes = await Promise.all(rows.map((r) => getSimpleQuote(r.symbol)));

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/5 bg-[#0f0f0f]">
      <table className="min-w-full text-sm">
        <thead className="text-xs text-gray-400 border-b border-white/5">
          <tr>
            <th className="text-left p-4 font-medium">{tServer('table.name')}</th>
            <th className="text-right p-4 font-medium">{tServer('table.value')}</th>
            <th className="text-right p-4 font-medium">{tServer('table.change')}</th>
            <th className="text-right p-4 font-medium">{tServer('table.chgPercent')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const q = quotes[idx];
            const isUp = (q?.change ?? 0) > 0;
            const isDown = (q?.change ?? 0) < 0;
            const changeClass = isUp ? 'text-red-500' : isDown ? 'text-green-500' : 'text-gray-300';

            return (
              <tr key={r.symbol} className="border-b border-white/5 last:border-b-0 hover:bg-white/5">
                <td className="p-4">
                  <Link href={`/stocks/${encodeURIComponent(r.symbol)}`} className="text-white hover:underline">
                    {r.label}
                  </Link>
                  {r.name ? <div className="text-xs text-gray-400 mt-1">{r.name}</div> : null}
                </td>
                <td className="p-4 text-right text-white">
                  {formatNumber(q?.price ?? null, 2)}{' '}
                  <span className="text-xs text-gray-500">{q?.currency ?? ''}</span>
                </td>
                <td className={`p-4 text-right font-medium ${changeClass}`}>
                  {q?.change == null ? '--' : `${q.change > 0 ? '+' : ''}${formatNumber(q.change, 2)}`}
                </td>
                <td className={`p-4 text-right font-medium ${changeClass}`}>
                  {q?.changePercent == null
                    ? '--'
                    : `${q.changePercent > 0 ? '+' : ''}${formatNumber(q.changePercent, 2)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
