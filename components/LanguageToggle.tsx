'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function LanguageToggle() {
  const { lang, toggleLang, t } = useI18n();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={toggleLang}
      className="ml-2 bg-gray-800/60 hover:bg-gray-700 text-gray-100 border border-gray-700"
      title={lang === 'en' ? t('lang.switchToZh') : t('lang.switchToEn')}
    >
      {lang === 'en' ? t('lang.zh') : t('lang.en')}
    </Button>
  );
}
