'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import SearchCommand from '@/components/SearchCommand';
import LanguageToggle from '@/components/LanguageToggle';
import { NAV_ITEMS } from '@/lib/constants';
import { useI18n } from '@/lib/i18n';

const NavItems = ({ initialStocks }: { initialStocks: StockWithWatchlistStatus[] }) => {
  const pathname = usePathname();
  const { t } = useI18n();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <ul className="flex flex-col sm:flex-row p-2 gap-3 sm:gap-10 font-medium items-start sm:items-center">
      {NAV_ITEMS.map(({ href, labelKey }) => {
        if (href === '/search') {
          return (
            <li key="search-trigger">
              <SearchCommand renderAs="text" label={t('nav.search')} initialStocks={initialStocks} />
            </li>
          );
        }

        return (
          <li key={href}>
            <Link href={href} className={`hover:text-teal-500 transition-colors ${isActive(href) ? 'text-gray-100' : ''}`}>
              {t(labelKey)}
            </Link>
          </li>
        );
      })}

      <li key="lang-toggle" className="sm:ml-2">
        <LanguageToggle />
      </li>
    </ul>
  );
};

export default NavItems;
