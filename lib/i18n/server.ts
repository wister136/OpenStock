import { cookies } from 'next/headers';
import { DEFAULT_LANG, type Lang, MESSAGES } from './messages';

type Vars = Record<string, string | number | boolean | null | undefined>;

function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

export function getServerLang(): Lang {
  const stored = cookies().get('openstock_locale')?.value;
  return stored === 'zh' || stored === 'en' ? stored : DEFAULT_LANG;
}

export function tServer(key: string, vars?: Vars): string {
  const lang = getServerLang();
  const dict = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANG];
  const raw = dict[key] ?? MESSAGES[DEFAULT_LANG][key] ?? key;
  return format(raw, vars);
}
