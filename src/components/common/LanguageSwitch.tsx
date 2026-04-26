import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

interface Props {
  altLangUrl?: string;
}

export default function LanguageSwitch({ altLangUrl }: Props) {
  const [currentLang, setCurrentLang] = useState<'zh' | 'en'>('zh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const path = window.location.pathname;
    const isEn = path.startsWith('/en');
    setCurrentLang(isEn ? 'en' : 'zh');
  }, []);

  const toggle = () => {
    // Use altLangUrl if provided (for articles with different slugs)
    if (altLangUrl) {
      window.location.href = altLangUrl;
      return;
    }

    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    const path = window.location.pathname;

    let newPath: string;
    if (newLang === 'en') {
      // Switching to English
      newPath = '/en' + (path === '/' ? '' : path);
    } else {
      // Switching to Chinese
      newPath = path.replace(/^\/en/, '') || '/';
    }

    window.location.href = newPath;
  };

  if (!mounted) {
    return (
      <button className="p-2 rounded-xl min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        中
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 p-2 rounded-xl min-w-[44px] min-h-[44px] hover:opacity-80 transition-opacity text-xs font-medium"
      style={{ color: 'var(--color-text-secondary)' }}
      aria-label="Switch language"
    >
      <Globe size={16} />
      <span>{currentLang === 'zh' ? 'EN' : '中'}</span>
    </button>
  );
}
