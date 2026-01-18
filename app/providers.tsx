'use client';

import React from 'react';
import { I18nProvider } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n/messages';

export default function Providers({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  return <I18nProvider initialLang={initialLang}>{children}</I18nProvider>;
}
