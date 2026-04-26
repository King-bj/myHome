import { defaultLang, type Lang } from '../i18n';

export interface NavItem {
  href: string;
  label: string;
}

const NAV_PATHS = ['/', '/projects', '/articles', '/videos', '/about'] as const;
const NAV_LABEL_KEYS = ['nav.home', 'nav.projects', 'nav.articles', 'nav.videos', 'nav.about'] as const;

export function buildNavItems(lang: Lang, t: (key: string) => string): NavItem[] {
  const prefix = lang === defaultLang ? '' : `/${lang}`;
  return NAV_PATHS.map((path, index) => ({
    href: `${prefix}${path}`,
    label: t(NAV_LABEL_KEYS[index]),
  }));
}
