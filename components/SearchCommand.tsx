'use client';

import { useEffect, useMemo, useState } from 'react';
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { useDebounce } from '@/hooks/useDebounce';
import { useI18n } from '@/lib/i18n';

export default function SearchCommand({
  renderAs = 'button',
  label,
  initialStocks,
}: SearchCommandProps) {
  const { t } = useI18n();

  const displayLabel = label ?? t('search.addStock');

  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks);

  const isSearchMode = !!searchTerm.trim();
  const displayStocks = useMemo(
    () => (isSearchMode ? stocks : stocks?.slice(0, 10)),
    [isSearchMode, stocks]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearch = async () => {
    if (!isSearchMode) return setStocks(initialStocks);

    setLoading(true);
    try {
      const results = await searchStocks(searchTerm.trim());
      setStocks(results);
    } catch {
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useDebounce(handleSearch, 300);

  useEffect(() => {
    debouncedSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleSelectStock = () => {
    setOpen(false);
    setSearchTerm('');
  };

  const emptyText = loading
    ? t('search.loadingStocks')
    : isSearchMode
      ? t('search.noResultsFound')
      : t('search.noStocksAvailable');

  const sectionTitle = isSearchMode ? t('search.searchResults') : t('search.popularStocks');

  return (
    <>
      {renderAs === 'text' ? (
        <button type="button" onClick={() => setOpen(true)} className="search-text">
          {displayLabel}
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} className="search-btn">
          {displayLabel}
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen} className="search-dialog">
        <div className="search-field">
          <CommandInput
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder={t('search.placeholder')}
            className="search-input"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
        </div>

        <CommandList className="search-list scrollbar-hide-default">
          <CommandEmpty className="search-list-empty">{emptyText}</CommandEmpty>

          {!!displayStocks?.length && (
            <div className="search-list-title">
              {sectionTitle} ({displayStocks.length})
            </div>
          )}

          {!!displayStocks?.length && (
            <ul className="search-list-items">
              {displayStocks.map((stock) => (
                <li key={stock.symbol} className="search-item">
                  <Link
                    href={`/stocks/${stock.symbol}`}
                    onClick={handleSelectStock}
                    className="search-item-link"
                  >
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="search-item-name">{stock.name}</div>
                      <div className="text-sm text-gray-500">
                        {stock.symbol} | {stock.exchange} | {stock.type}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
