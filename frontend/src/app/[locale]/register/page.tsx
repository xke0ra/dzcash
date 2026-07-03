"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import Link from 'next/link';
import { UserPlus, Mail, Lock, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { generateFingerprint } from '@/lib/device-fingerprint';

export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referredByCode, setReferredByCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const t = useTranslations('auth');
  const te = useTranslations('errors');

  useEffect(() => {
    generateFingerprint().then(setFingerprint);
  }, []);

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    // Auto-populate referral code if present in the URL
    const ref = searchParams.get('ref') || searchParams.get('referralCode');
    if (ref) {
      setReferredByCode(ref);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'x-device-fingerprint': fingerprint } : {}),
        },
        body: JSON.stringify({
          email,
          password,
          referredByCode: referredByCode || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || te('submissionFailed'));
      }

      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(email)}`);
      }, 2000);
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
          <UserPlus className="w-6 h-6 text-sky-400" />
          <span>Create Account on <span className="text-sky-400">DZCASH</span></span>
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6">Join thousands of users earning passive income today.</p>

        {error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm mb-4">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm mb-4">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Referral Code (Optional)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Users className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={referredByCode}
                onChange={(e) => setReferredByCode(e.target.value)}
                placeholder="E.G. ABCDEF"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-500 text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-sky-400 disabled:opacity-50 active:scale-98 transition-all duration-200 text-sm mt-6"
          >
            {isSubmitting ? 'Registering...' : t('registerButton')}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-sky-400 hover:underline font-semibold">
            {t('loginTitle')}
          </Link>
        </p>
      </div>
    </div>
  );
}
