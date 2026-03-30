import en from './translations/en';
import ja from './translations/ja';

export type Locale = 'en' | 'ja';

const translations: Record<Locale, typeof en> = { en, ja };

export function getLocaleFromUrl(url: URL): Locale {
  const [, segment] = url.pathname.split('/');
  if (segment === 'ja') return 'ja';
  return 'en';
}

export function t(locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: any = translations[locale];
  for (const k of keys) {
    value = value?.[k];
  }
  if (typeof value === 'string') return value;
  // Fallback to English
  let fallback: any = translations.en;
  for (const k of keys) {
    fallback = fallback?.[k];
  }
  return typeof fallback === 'string' ? fallback : key;
}

export function getLocalePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === 'en') return clean;
  return `/ja${clean}`;
}

export function getAlternateUrl(locale: Locale, currentPath: string): string {
  const altLocale = locale === 'en' ? 'ja' : 'en';
  if (altLocale === 'ja') {
    // Add /ja prefix
    return `/ja${currentPath}`;
  }
  // Remove /ja prefix
  return currentPath.replace(/^\/ja/, '') || '/';
}
