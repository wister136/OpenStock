'use client';

import Link from 'next/link';
import React from 'react';
import { useI18n } from '@/lib/i18n';

export default function DetailLinkButton({ href }: { href: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-md bg-white/10 px-3 py-2 text-sm text-gray-100 hover:bg-white/15 transition-colors"
    >
      {t('common.viewDetails')}
    </Link>
  );
}
