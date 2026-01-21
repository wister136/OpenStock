'use client';

import React from 'react';
import { I18nProvider } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n/messages';
import { ThemeProvider } from 'next-themes';

export default function Providers({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <I18nProvider initialLang={initialLang}>{children}</I18nProvider>
    </ThemeProvider>
  );
}
