"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import { Users, DollarSign, Coins, ShieldAlert, Activity, Gift, TrendingUp, Clock } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOffers: number;
  totalClicks: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalAmount: number;
  fraudCases: number;
  todaySignups: number;
  todayEarned: number;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const te = useTranslations('errors');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(te('loadFailed', { page: 'stats' }));
        setStats(await res.json());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400" />
        <p className="text-slate-400 mt-4 text-sm">{common('loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>
    );
  }

  const cards = [
    { label: t('totalUsers'), value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: t('activeUsers'), value: stats?.activeUsers ?? 0, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('todaySignups'), value: stats?.todaySignups ?? 0, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: t('totalOffers'), value: stats?.totalOffers ?? 0, icon: Gift, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: t('totalClicks'), value: stats?.totalClicks ?? 0, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: t('totalEarned'), value: `$${(stats?.totalEarned ?? 0).toFixed(2)}`, icon: Coins, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('totalWithdrawn'), value: `$${(stats?.totalWithdrawn ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('todayEarned'), value: `$${(stats?.todayEarned ?? 0).toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('pendingWithdrawals'), value: stats?.pendingWithdrawalCount ?? 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: t('pendingAmount'), value: `$${(stats?.pendingWithdrawalAmount ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: t('fraudCases'), value: stats?.fraudCases ?? 0, icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('dashboard')}</h1>
        <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-extrabold text-white">{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
