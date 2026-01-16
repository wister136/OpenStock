'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

export default function SectionTitle({ titleKey, fallback }: { titleKey: string; fallback?: string }) {
  const { t } = useI18n();
  return <h3 className="font-semibold text-2xl text-gray-100 mb-5">{t(titleKey) || fallback || titleKey}</h3>;
}
