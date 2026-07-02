import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import ClientLayout from './client-layout';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <title>DZCASH - Get Paid To Rewards Platform</title>
        <meta name="description" content="اكمل المهام اليومية واربح المال من الاستبيانات وتحميل التطبيقات" />
      </head>
      <body className={locale === 'ar' ? 'font-arabic' : ''}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientLayout>{children}</ClientLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
