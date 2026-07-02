"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  User, Mail, Calendar, Shield, Key, Globe, Bell,
  Smartphone, Eye, EyeOff, Save, Copy, Check, AlertCircle
} from 'lucide-react';

export default function ProfilePage() {
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const t = useTranslations('common');

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Email notifications
  const [emailNotifs, setEmailNotifs] = useState({
    offerCompleted: true,
    withdrawalStatus: true,
    fraudAlert: true,
    marketing: false,
  });

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); router.push('/login'); return; }
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data);
      updateUser({
        id: data.id, email: data.email, role: data.role,
        status: data.status, riskScore: data.riskScore,
        referralCode: data.referralCode,
      });
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchProfile();
  }, [token]);

  const copyReferralLink = () => {
    if (!profile?.referralCode) return;
    const link = `${window.location.origin}/register?ref=${profile.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to change password');
      }
      setSuccess('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { setError(err.message); }
    finally { setChangingPassword(false); }
  };

  const handleNotifSave = async () => {
    setSuccess('Notification preferences saved');
    setTimeout(() => setSuccess(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400" />
      </div>
    );
  }

  const accountAge = profile ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center">
            <span className="text-2xl font-extrabold text-sky-400">{profile?.email?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile?.email}</h1>
            <p className="text-sm text-slate-400 mt-1">
              Member for {accountAge} days · Joined {profile ? new Date(profile.createdAt).toLocaleDateString() : ''}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />{success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <User className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Account Details</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-950 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-200">{profile?.email}</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                Verified
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-950 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Role</p>
                  <p className="text-sm font-medium text-slate-200 capitalize">{profile?.role?.toLowerCase() || 'User'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-950 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Account Status</p>
                  <p className="text-sm font-medium text-slate-200">{profile?.status}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                profile?.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : profile?.status === 'FROZEN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>{profile?.status}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-950 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Member Since</p>
                  <p className="text-sm font-medium text-slate-200">
                    {profile ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-950 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Risk Score</p>
                  <p className="text-sm font-medium text-slate-200">{profile?.riskScore}%</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                (profile?.riskScore || 0) < 40 ? 'text-emerald-400 bg-emerald-500/10'
                : (profile?.riskScore || 0) < 70 ? 'text-amber-400 bg-amber-500/10'
                : 'text-rose-400 bg-rose-500/10'
              }`}>
                {(profile?.riskScore || 0) < 40 ? 'Low Risk' : (profile?.riskScore || 0) < 70 ? 'Medium Risk' : 'High Risk'}
              </span>
            </div>
          </div>
        </div>

        {/* Referral Program */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Globe className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Referral Program</h3>
          </div>
          <p className="text-sm text-slate-400">
            Earn <span className="text-sky-400 font-semibold">10% commission</span> on all earnings from users you refer.
            Share your link and start earning passive income.
          </p>
          <div className="space-y-2">
            <label className="text-xs text-slate-500 block">Your Referral Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={profile ? `${window.location.origin}/register?ref=${profile.referralCode}` : ''}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm font-mono focus:outline-none"
              />
              <button
                onClick={copyReferralLink}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl transition-colors"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="bg-slate-950 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Referral Code</span>
              <span className="text-sky-400 font-bold font-mono">{profile?.referralCode}</span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Key className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Change Password</h3>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="relative">
              <label className="text-xs text-slate-500 block mb-1">Current Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50 pr-10"
                required
              />
            </div>
            <div className="relative">
              <label className="text-xs text-slate-500 block mb-1">New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50 pr-10"
                required minLength={6}
              />
            </div>
            <div className="relative">
              <label className="text-xs text-slate-500 block mb-1">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-500/50 pr-10"
                required minLength={6}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPassword ? 'Hide' : 'Show'} passwords
            </button>
            <button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword}
              className="w-full bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Notification Preferences */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Bell className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Notifications</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: 'offerCompleted', label: 'Offer Completed' },
              { key: 'withdrawalStatus', label: 'Withdrawal Status Updates' },
              { key: 'fraudAlert', label: 'Security Alerts' },
              { key: 'marketing', label: 'Marketing & Promotions' },
            ].map(item => (
              <label key={item.key} className="flex items-center justify-between bg-slate-950 rounded-xl p-4 cursor-pointer hover:bg-slate-900 transition-colors">
                <span className="text-sm text-slate-300">{item.label}</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={(emailNotifs as any)[item.key]}
                    onChange={() => setEmailNotifs(prev => ({ ...prev, [item.key]: !(prev as any)[item.key] }))}
                    className="sr-only"
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${(emailNotifs as any)[item.key] ? 'bg-sky-500' : 'bg-slate-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mt-0.5 ${(emailNotifs as any)[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={handleNotifSave}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Save Preferences
          </button>
        </div>

        {/* Sessions / Devices */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <Smartphone className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">Active Sessions</h3>
          </div>
          <div className="bg-slate-950 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">Current Session</p>
                <p className="text-xs text-slate-500">Web browser · {navigator?.userAgent?.slice(0, 50) || 'Unknown'}...</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold">Active</span>
          </div>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/30 font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            Log Out All Sessions
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <h3 className="text-lg font-bold text-rose-400">Danger Zone</h3>
          </div>
          <p className="text-xs text-slate-400">Irreversible actions that cannot be undone.</p>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                fetch('/api/users/me', {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }).then(() => { logout(); router.push('/register'); });
              }
            }}
            className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/30 font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
