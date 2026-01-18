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
