"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Coins, Copy, Check, Users, Shield, AlertTriangle, ArrowUpRight, DollarSign, Clock } from 'lucide-react';

interface ProfileData {
  id: string;
  email: string;
  status: string;
  riskScore: number;
  referralCode: string;
  createdAt: string;
  wallet: {
    pendingBalance: string;
    availableBalance: string;
  };
}

interface Referral {
  id: string;
  email: string;
  createdAt: string;
  status: string;
}

export default function Dashboard() {
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch Profile
        const profileRes = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (profileRes.status === 401) {
          logout();
          router.push('/login');
          return;
        }

        if (!profileRes.ok) {
          throw new Error('Failed to load profile data');
        }

        const profileData = await profileRes.json();
        setProfile(profileData);
        
        // Sync auth context user state if risk score/status changed
        updateUser({
          id: profileData.id,
          email: profileData.email,
          status: profileData.status,
          riskScore: profileData.riskScore,
        });

        // Fetch Referrals
        const referralsRes = await fetch('/api/users/referrals', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (referralsRes.ok) {
          const referralsData = await referralsRes.json();
          setReferrals(referralsData);
        }

      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, router, logout, updateUser]);

  const copyReferralLink = () => {
    if (!profile) return;
    const link = `${window.location.origin}/register?ref=${profile.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl max-w-xl mx-auto my-12 text-center">
        <p className="font-bold mb-2">Error Loading Dashboard</p>
        <p className="text-sm mb-4">{error || 'Session expired. Please log in again.'}</p>
        <button onClick={() => router.push('/login')} className="bg-rose-500 text-white px-4 py-2 rounded-lg font-semibold text-sm">
          Return to Sign In
        </button>
      </div>
    );
  }

  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/register?ref=${profile.referralCode}`
    : `https://dzcash.com/register?ref=${profile.referralCode}`;

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Track your earnings, referrals, and account status.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              profile.status === 'ACTIVE' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : profile.status === 'FROZEN'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              Status: {profile.status}
            </span>
            <span className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              profile.riskScore < 50
                ? 'bg-slate-800 text-sky-400 border-slate-700'
                : profile.riskScore < 75
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <Shield className="w-3.5 h-3.5" />
              Risk Score: {profile.riskScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Balance Ledger Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between hover:border-emerald-500/30 transition-all duration-300">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Balance</p>
            <h3 className="text-3xl font-extrabold text-emerald-400">${parseFloat(profile.wallet.availableBalance).toFixed(2)}</h3>
            <p className="text-xs text-slate-500">Unlocked and ready to cash out instantly</p>
          </div>
          <div className="bg-emerald-500/10 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-400">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between hover:border-sky-500/30 transition-all duration-300">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Balance</p>
            <h3 className="text-3xl font-extrabold text-sky-400">${parseFloat(profile.wallet.pendingBalance).toFixed(2)}</h3>
            <p className="text-xs text-slate-500">Earning locked under security clearing verification</p>
          </div>
          <div className="bg-sky-500/10 w-14 h-14 rounded-2xl flex items-center justify-center text-sky-400">
            <Clock className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Referral Link & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Users className="w-6 h-6 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Referral Program</h3>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-slate-400 leading-relaxed">
              Earn <span className="text-sky-400 font-semibold">10% commission</span> on all offers completed by your referred users. There is no limit to how much you can earn!
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Referral Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-mono focus:outline-none"
              />
              <button
                onClick={copyReferralLink}
                className="flex items-center justify-center bg-slate-800 hover:bg-slate-750 text-slate-300 px-4 py-3 rounded-xl transition-colors shrink-0"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Referrals Stats list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white">Your Referrals</h3>
            <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">
              {referrals.length} Active
            </span>
          </div>

          {referrals.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-slate-500">You haven&apos;t referred anyone yet.</p>
              <p className="text-xs text-sky-400 cursor-pointer font-semibold" onClick={copyReferralLink}>Copy link to share</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-48 pr-1">
              {referrals.map((ref) => (
                <div key={ref.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-850">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">{ref.email.split('@')[0]}...@{ref.email.split('@')[1]}</p>
                    <p className="text-[10px] text-slate-500">{new Date(ref.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                    {ref.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
