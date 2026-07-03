import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../providers/auth-provider';

// Mock next-intl
vi.mock('next-intl', () => ({
  useLocale: () => 'ar',
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'nav.dashboard': 'الرئيسية',
      'nav.offers': 'العروض',
      'nav.wallet': 'المحفظة',
      'nav.signIn': 'تسجيل الدخول',
      'nav.signOut': 'تسجيل الخروج',
      'common.loading': 'جار التحميل...',
    };
    return translations[key] || key;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('js-cookie', () => ({
  default: { set: vi.fn(), get: vi.fn() },
}));

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    const { default: LanguageSwitcher } = await import('../components/LanguageSwitcher');
    render(<LanguageSwitcher />);
  });

  it('renders current language', () => {
    expect(screen.getAllByText('العربية')).toHaveLength(2);
  });
});

describe('NotificationBell', () => {
  beforeEach(async () => {
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [], total: 0, unreadCount: 0 }),
      }),
    ) as any;

    const { default: NotificationBell } = await import('../components/NotificationBell');
    render(
      <AuthProvider>
        <NotificationBell />
      </AuthProvider>,
    );
  });

  it('renders bell icon', () => {
    const bell = document.querySelector('button');
    expect(bell).toBeInTheDocument();
  });
});
