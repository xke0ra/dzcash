# Internationalization (i18n) - DZCASH

> **Purpose**: Complete guide for Arabic/English translation system with RTL support.

---

## Technology Choice: next-intl

**Why next-intl:**
- Native Next.js App Router support (Parallel/Intercepting routes)
- Server Components compatible (no JS on client for translations)
- Built-in RTL support
- File-based messages (JSON)
- Type-safe translations (with TypeScript)
- Small bundle size (~5KB gzip)

---

## Setup

### Installation
```bash
npm install next-intl
```

### File Structure
```
messages/
├── ar.json                 # Arabic translations (RTL)
└── en.json                 # English translations (LTR)

i18n/
├── request.ts              # Server-side locale detection
└── routing.ts              # Route configuration

middleware.ts               # Locale routing middleware
next.config.js              # Plugin configuration
```

### Configuration

```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
}));
```

```typescript
// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';
 
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always', // /ar/dashboard, /en/dashboard
});
```

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

```javascript
// next.config.js
const withNextIntl = require('next-intl/plugin')('./i18n/request.ts');
module.exports = withNextIntl({
  // ... other config
});
```

### Root Layout
```typescript
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

## RTL Support

### globals.css
```css
/* RTL support */
[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

[dir="ltr"] {
  direction: ltr;
  text-align: left;
}

/* RTL spacing adjustments */
[dir="rtl"] .space-x-reverse > :not([hidden]) ~ :not([hidden]) {
  --tw-space-x-reverse: 1;
}
```

### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  // ... existing config
  plugins: [
    require('tailwindcss-rtl'),
  ],
};
```

### Component Adjustments
```tsx
// For RTL-aware icons
<ChevronLeft className={locale === 'ar' ? 'rotate-180' : ''} />

// For RTL-aware margins/paddings
<div className="ms-2 me-4">  {/* Use start/end instead of left/right */}
```

---

## Message Files

### Structure
```json
// messages/ar.json
{
  "common": {
    "loading": "جارٍ التحميل...",
    "error": "حدث خطأ",
    "save": "حفظ",
    "cancel": "إلغاء",
    "confirm": "تأكيد"
  },
  "auth": {
    "login": {
      "title": "تسجيل الدخول",
      "email": "البريد الإلكتروني",
      "password": "كلمة المرور",
      "submit": "دخول",
      "noAccount": "ليس لديك حساب؟",
      "registerLink": "سجل الآن"
    },
    "register": {
      "title": "إنشاء حساب جديد",
      "email": "البريد الإلكتروني",
      "password": "كلمة المرور",
      "confirmPassword": "تأكيد كلمة المرور",
      "referralCode": "رمز الإحالة (اختياري)",
      "submit": "إنشاء حساب",
      "haveAccount": "لديك حساب بالفعل؟",
      "loginLink": "تسجيل الدخول"
    }
  },
  "dashboard": {
    "title": "لوحة التحكم",
    "availableBalance": "الرصيد المتاح",
    "pendingBalance": "الرصيد المعلق",
    "referralProgram": "برنامج الإحالة",
    "yourReferrals": "إحالاتك",
    "referralLink": "رابط الإحالة الخاص بك",
    "earnTenPercent": "اربح 10% عمولة على جميع عروض الأشخاص الذين سجلوا عن طريقك"
  },
  "offers": {
    "title": "العروض المتاحة",
    "startOffer": "ابدأ العرض",
    "generatingSession": "جارٍ إنشاء الجلسة...",
    "noOffers": "لا توجد عروض نشطة حالياً",
    "earn": "اربح"
  },
  "wallet": {
    "title": "المحفظة",
    "withdraw": "سحب",
    "withdrawTitle": "طلب سحب",
    "method": "طريقة السحب",
    "amount": "المبلغ",
    "minimumWithdraw": "الحد الأدنى للسحب: $5.00",
    "insufficientBalance": "الرصيد غير كافٍ",
    "withdrawalHistory": "سجل السحوبات",
    "transactionHistory": "سجل المعاملات"
  },
  "admin": {
    "dashboard": "لوحة الإدارة",
    "users": "المستخدمين",
    "offers": "العروض",
    "withdrawals": "السحوبات",
    "fraud": "الاحتيال"
  },
  "validation": {
    "required": "هذا الحقل مطلوب",
    "email": "البريد الإلكتروني غير صالح",
    "minLength": "يجب أن يكون على الأقل {min} حرف",
    "maxLength": "يجب أن لا يتجاوز {max} حرف",
    "min": "يجب أن يكون على الأقل {min}",
    "max": "يجب أن لا يتجاوز {max}",
    "passwordMatch": "كلمة المرور غير متطابقة"
  }
}
```

```json
// messages/en.json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm"
  },
  "auth": {
    "login": {
      "title": "Sign In",
      "email": "Email Address",
      "password": "Password",
      "submit": "Sign In",
      "noAccount": "Don't have an account?",
      "registerLink": "Register Now"
    }
  },
  "dashboard": {
    "title": "Dashboard",
    "availableBalance": "Available Balance",
    "pendingBalance": "Pending Balance",
    "referralProgram": "Referral Program",
    "yourReferrals": "Your Referrals",
    "referralLink": "Your Referral Link",
    "earnTenPercent": "Earn 10% commission on all offers completed by your referrals"
  },
  "offers": {
    "title": "Available Offers",
    "startOffer": "Start Offer",
    "generatingSession": "Generating Session...",
    "noOffers": "No active offers available",
    "earn": "Earn"
  },
  "wallet": {
    "title": "Wallet",
    "withdraw": "Withdraw",
    "withdrawTitle": "Withdrawal Request",
    "method": "Withdrawal Method",
    "amount": "Amount",
    "minimumWithdraw": "Minimum withdrawal: $5.00",
    "insufficientBalance": "Insufficient balance",
    "withdrawalHistory": "Withdrawal History",
    "transactionHistory": "Transaction History"
  },
  "validation": {
    "required": "This field is required",
    "email": "Invalid email address",
    "minLength": "Must be at least {min} characters",
    "min": "Must be at least {min}"
  }
}
```

---

## Usage in Components

### Server Component
```tsx
// app/[locale]/dashboard/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('availableBalance')}: $25.00</p>
    </div>
  );
}
```

### Client Component
```tsx
'use client';

import { useTranslations } from 'next-intl';

export function BalanceCard({ amount }: { amount: number }) {
  const t = useTranslations('dashboard');
  
  return (
    <div>
      <h3>{t('availableBalance')}</h3>
      <p>${amount.toFixed(2)}</p>
    </div>
  );
}
```

### With Parameters
```tsx
// messages/ar.json: "minLength": "يجب أن يكون على الأقل {min} حرف"
// messages/en.json: "minLength": "Must be at least {min} characters"

const t = useTranslations('validation');
t('minLength', { min: 6 });
// Arabic: "يجب أن يكون على الأقل 6 حرف"
// English: "Must be at least 6 characters"
```

### Rich Text
```tsx
// messages/ar.json: "referralDescription": "اربح <bold>10%</bold> عمولة على جميع العروض"
// messages/en.json: "referralDescription": "Earn <bold>10%</bold> on all offers"

t.rich('referralDescription', {
  bold: (chunks) => <strong>{chunks}</strong>,
});
```

### Number & Date Formatting
```tsx
import { useFormatter } from 'next-intl';

const format = useFormatter();

// Numbers
format.number(2500.5, { style: 'currency', currency: 'USD' });
// Arabic: $2,500.50
// English: $2,500.50

// Dates
format.relativeTime(new Date('2026-07-01'), { now: new Date() });
// Arabic: "منذ يوم واحد"
// English: "1 day ago"
```

---

## Language Switcher

```tsx
'use client';

import { usePathname, useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (newLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => switchLocale('ar')}
        disabled={locale === 'ar'}
        className={`px-3 py-1 rounded ${locale === 'ar' ? 'bg-sky-500 text-white' : 'bg-slate-700'}`}
      >
        العربية
      </button>
      <button
        onClick={() => switchLocale('en')}
        disabled={locale === 'en'}
        className={`px-3 py-1 rounded ${locale === 'en' ? 'bg-sky-500 text-white' : 'bg-slate-700'}`}
      >
        English
      </button>
    </div>
  );
}
```

---

## Translation Checklist

### Pages
- [ ] Landing page
- [ ] Login page
- [ ] Register page
- [ ] Dashboard
- [ ] Offers list
- [ ] Wallet
- [ ] Admin dashboard
- [ ] Admin users
- [ ] Admin offers

### Components
- [ ] Navbar
- [ ] Balance cards
- [ ] Offer cards
- [ ] Withdrawal form
- [ ] Referral section
- [ ] Admin tables
- [ ] Error messages
- [ ] Loading states
- [ ] Empty states
- [ ] Form validation
- [ ] Notifications

### Static
- [ ] Page titles (SEO)
- [ ] Meta descriptions
- [ ] Alt texts for images
- [ ] Placeholder texts

---

*Last Updated: 2026-07-02 | Version: 1.0.0*