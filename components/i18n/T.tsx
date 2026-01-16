'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';

type Props = {
  k: string;
  vars?: Record<string, string | number | boolean | null | undefined>;
};

export default function T({ k, vars }: Props) {
  const { t } = useI18n();
  return <>{t(k, vars)}</>;
}

// 在 en: {...} 里加：
'home.myStocks': 'My Stocks',
'common.viewDetails': 'View details',

// 在 zh: {...} 里加：
'home.myStocks': '我的股票',
'common.viewDetails': '查看详情',
