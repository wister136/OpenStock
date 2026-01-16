'use client';

import React, { createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart } from 'lucide-react';

import SearchCommand from '@/components/SearchCommand';
import LanguageToggle from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { NAV_ITEMS } from '@/lib/constants';
import { useI18n } from '@/lib/i18n';

// Create context for popup state
const DonatePopupContext = createContext<{
  openDonatePopup: () => void;
}>({
  openDonatePopup: () => {},
});

export const useDonatePopup = () => useContext(DonatePopupContext);

const NavItems = ({ initialStocks }: { initialStocks: StockWithWatchlistStatus[] }) => {
  const pathname = usePathname();
  const { t } = useI18n();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const openDonatePopup = () => {
    window.dispatchEvent(new CustomEvent('open-donate-popup'));
  };

  return (
    <DonatePopupContext.Provider value={{ openDonatePopup }}>
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
              <Link
                href={href}
                className={`hover:text-teal-500 transition-colors ${isActive(href) ? 'text-gray-100' : ''}`}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}

        <li key="lang-toggle" className="sm:ml-2">
          <LanguageToggle />
        </li>

        <li key="donate">
          <Button
            onClick={openDonatePopup}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 animate-pulse"
            size="sm"
          >
            <Heart className="h-4 w-4 fill-current" />
            {t('nav.donate')}
          </Button>
        </li>
      </ul>
    </DonatePopupContext.Provider>
  );
};

export default NavItems;
