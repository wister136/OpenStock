'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, Lang, MESSAGES } from './messages';

const STORAGE_KEY = 'openstock_locale';
const COOKIE_KEY = 'openstock_locale';

type Vars = Record<string, string | number | boolean | null | undefined>;

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string, vars?: Vars) => string;
  tvLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function langToTradingViewLocale(lang: Lang) {
  return lang === 'zh' ? 'zh_CN' : 'en';
}

export function I18nProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? DEFAULT_LANG);

  useEffect(() => {
    try {
      const saved =
        (window.localStorage.getItem(STORAGE_KEY) as Lang | null) ??
        (window.localStorage.getItem('openstock.lang') as Lang | null);
      if (saved === 'en' || saved === 'zh') {
        if (saved !== lang) setLangState(saved);
      }
    } catch {}
  }, [lang]);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    try {
      document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=31536000`;
    } catch {}
    try {
      document.documentElement.lang = next;
    } catch {}
  };

  const toggleLang = () => setLang(lang === 'en' ? 'zh' : 'en');

  const dict = useMemo(() => MESSAGES[lang] ?? MESSAGES[DEFAULT_LANG], [lang]);

  const t = (key: string, vars?: Vars) => {
    const raw = dict[key] ?? MESSAGES[DEFAULT_LANG][key] ?? key;
    return format(raw, vars);
  };

  const value: I18nContextValue = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang,
      t,
      tvLocale: langToTradingViewLocale(lang),
    }),
    [lang, dict]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback (shouldn't happen if Providers are wired correctly)
    const tvLocale = langToTradingViewLocale(DEFAULT_LANG);
    return {
      lang: DEFAULT_LANG,
      setLang: () => {},
      toggleLang: () => {},
      t: (key: string) => MESSAGES[DEFAULT_LANG][key] ?? key,
      tvLocale,
    } as I18nContextValue;
  }
  return ctx;
}
