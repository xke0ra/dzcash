"use client";

import '../globals.css';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Coins, LogOut, LayoutDashboard, Shield, Wallet, User, FileText, Menu, X, Trophy } from 'lucide-react';
import { useState } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationBell from '@/components/NotificationBell';
import NotificationToast from '@/components/NotificationToast';
import PwaRegister from '@/components/PwaRegister';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  const role = user?.role || 'USER';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 rtl:space-x-reverse text-sky-400 font-extrabold text-2xl tracking-wider hover:text-sky-300 transition-colors">
              <Coins className="w-8 h-8 text-sky-400 animate-pulse" />
              <span>DZ<span className="text-white">CASH</span></span>
            </Link>
            
            {user && (
              <div className="hidden md:flex mr-10 items-baseline space-x-4 rtl:space-x-reverse">
                <Link
                  href="/dashboard"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/dashboard')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t('dashboard')}
                </Link>
                <Link
                  href="/offers"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/offers')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  {t('offers')}
                </Link>
                <Link
                  href="/gamification"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/gamification')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  Gamification
                </Link>
                <Link
                  href="/wallet"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/wallet')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  {t('wallet')}
                </Link>
                <Link
                  href="/profile"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/profile')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <Link
                  href="/kyc"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/kyc')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  KYC
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      isActive('/admin')
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    {t('admin')}
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center space-x-4 rtl:space-x-reverse">
            <NotificationBell />
            <LanguageSwitcher minimal />
            {user ? (
              <div className="flex items-center gap-4">
                <div className="text-left rtl:text-right">
                  <p className="text-xs text-slate-400 font-medium">{t('loggedInAs')}</p>
                  <p className="text-sm text-slate-200 font-semibold">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-500/30 transition-all duration-300"
                >
                  <LogOut className="w-4 h-4" />
                  {t('signOut')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                <Link
                  href="/login"
                  className="text-slate-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors"
                >
                  {t('signIn')}
                </Link>
                <Link
                  href="/register"
                  className="bg-sky-500 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-sky-400 shadow-lg shadow-sky-500/20 active:scale-95 transition-all duration-200"
                >
                  {t('register')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-400 hover:text-white p-2 rounded-md focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-850 hover:text-white"
          >
            <LayoutDashboard className="w-5 h-5" />
            {t('dashboard')}
          </Link>
          <Link
            href="/offers"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-850 hover:text-white"
          >
            <Coins className="w-5 h-5" />
            {t('offers')}
          </Link>
          <Link
            href="/gamification"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-850 hover:text-white"
          >
            <Trophy className="w-5 h-5" />
            Gamification
          </Link>
          <Link
            href="/wallet"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-850 hover:text-white"
          >
            <Wallet className="w-5 h-5" />
            {t('wallet')}
          </Link>
          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-850 hover:text-white"
          >
            <User className="w-5 h-5" />
            Profile
          </Link>
          <Link
            href="/kyc"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-850 hover:text-white"
          >
            <FileText className="w-5 h-5" />
            KYC
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-base font-medium text-emerald-400 hover:bg-emerald-950/20"
            >
              <Shield className="w-5 h-5" />
              {t('admin')}
            </Link>
          )}
          <div className="border-t border-slate-800 mt-4 pt-4 flex flex-col gap-2 px-3">
            <p className="text-xs text-slate-500">{t('loggedInAs')}: {user.email}</p>
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full bg-rose-950/20 text-rose-400 border border-rose-900/30 py-2.5 rounded-lg text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              {t('signOut')}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PwaRegister />
      <PwaInstallPrompt />
      <NotificationToast />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </AuthProvider>
  );
}
