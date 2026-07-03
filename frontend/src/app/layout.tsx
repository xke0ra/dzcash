import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  const titles: Record<string, string> = {
    ar: 'DZCASH - اربح المال من إكمال المهام',
    en: 'DZCASH - Get Paid To Complete Tasks',
  };
  const descriptions: Record<string, string> = {
    ar: 'اكمل المهام اليومية واربح المال من الاستبيانات وتحميل التطبيقات. اسحب أرباحك فوراً عبر PayPal والعملات الرقمية.',
    en: 'Complete daily tasks and earn money from surveys, app installs, and more. Cash out instantly via PayPal and crypto.',
  };

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <title>{titles[locale] || titles.en}</title>
        <meta name="description" content={descriptions[locale] || descriptions.en} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={locale === 'ar' ? 'font-arabic' : ''}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
