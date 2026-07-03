"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Mail, Lock, LogIn, Shield, AlertCircle } from 'lucide-react';
import { generateFingerprint } from '@/lib/device-fingerprint';

export default function Login() {
  const { login, user } = useAuth();
  const router = useRouter();
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  useEffect(() => {
    generateFingerprint().then(setFingerprint);
  }, []);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-device-fingerprint': fingerprint } : {}),
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Please check credentials.');
      }

      if (data.needsTwoFactor) {
        setNeedsTwoFactor(true);
        setTwoFactorUserId(data.userId);
        setIsSubmitting(false);
        return;
      }

      login(data.accessToken, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || te('general'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: twoFactorUserId, token: twoFactorCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid 2FA code');
      }

      login(data.accessToken, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || te('general'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-center text-white mb-2 flex items-center justify-center gap-2">
          {needsTwoFactor ? <Shield className="w-6 h-6 text-sky-400" /> : <LogIn className="w-6 h-6 text-sky-400" />}
          <span>{needsTwoFactor ? 'Two-Factor Authentication' : `${t('loginTitle')} `}<span className="text-sky-400">DZCASH</span></span>
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          {needsTwoFactor ? 'Enter the 6-digit code from your authenticator app.' : 'Welcome back! Access your tasks and wallets.'}
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-4">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {needsTwoFactor ? (
          <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Authentication Code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-center text-2xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors tracking-widest"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || twoFactorCode.length !== 6}
              className="w-full bg-sky-500 text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-sky-400 disabled:opacity-50 active:scale-98 transition-all duration-200 text-sm"
            >
              {isSubmitting ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={() => { setNeedsTwoFactor(false); setTwoFactorCode(''); setError(null); }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('email')}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('password')}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-500 text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-sky-400 disabled:opacity-50 active:scale-98 transition-all duration-200 text-sm mt-6"
            >
              {isSubmitting ? 'Authenticating...' : t('loginButton')}
            </button>
          </form>
        )}

        {!needsTwoFactor && (
          <p className="text-center text-slate-400 text-sm mt-6">
            {t('noAccount')}{' '}
            <Link href="/register" className="text-sky-400 hover:underline font-semibold">
              {t('registerTitle')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
