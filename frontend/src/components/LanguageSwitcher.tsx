"use client";

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { localeNames, type Locale } from '../i18n-config';
import { Globe } from 'lucide-react';
import Cookies from 'js-cookie';

export default function LanguageSwitcher({ minimal = false }: { minimal?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: Locale) => {
    startTransition(() => {
      Cookies.set('NEXT_LOCALE', newLocale, { expires: 365 });
      router.refresh();
    });
  };

  if (minimal) {
    return (
      <button
        onClick={() => switchLocale(locale === 'ar' ? 'en' : 'ar')}
        disabled={isPending}
        className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
      >
        <Globe className="w-3 h-3" />
        {locale === 'ar' ? 'EN' : 'AR'}
      </button>
    );
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors px-3 py-2">
        <Globe className="w-4 h-4" />
        <span>{localeNames[locale as Locale]}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-[140px] overflow-hidden">
        {Object.entries(localeNames).map(([code, name]) => (
          <button
            key={code}
            onClick={() => switchLocale(code as Locale)}
            className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
              locale === code
                ? 'bg-sky-500/10 text-sky-400 font-medium'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
