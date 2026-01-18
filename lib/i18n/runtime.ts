import { DEFAULT_LANG, type Lang, MESSAGES } from './messages';

type Vars = Record<string, string | number | boolean | null | undefined>;

function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function getRuntimeLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const saved =
      (window.localStorage.getItem('openstock_locale') as Lang | null) ??
      (window.localStorage.getItem('openstock.lang') as Lang | null);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {}
  return DEFAULT_LANG;
}

export function tRuntime(key: string, vars?: Vars): string {
  const lang = getRuntimeLang();
  const dict = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANG];
  const raw = dict[key] ?? MESSAGES[DEFAULT_LANG][key] ?? key;
  return format(raw, vars);
}
