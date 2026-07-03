"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import { Search, Check, X, ExternalLink } from 'lucide-react';
import { safeFloat } from '@/lib/safe-float';

interface AdminWithdrawal {
  id: string;
  method: string;
  status: string;
  amount: string;
  fee: string;
  details: Record<string, any>;
  createdAt: string;
  user: { email: string; riskScore: number };
}

export default function AdminWithdrawalsPage() {
  const { token } = useAuth();
  const t = useTranslations('errors');
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModal, setRejectModal] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('loadFailed', { page: 'withdrawals' }));
      setWithdrawals(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('approvalFailed'));
      fetchWithdrawals();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error(t('rejectionFailed'));
      setRejectModal(null);
      setRejectReason('');
      fetchWithdrawals();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const totalAmount = withdrawals.reduce((sum, w) => sum + safeFloat(w.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
          <p className="text-sm text-slate-400 mt-1">
            {withdrawals.length} requests · Total: <span className="text-amber-400 font-bold">${totalAmount.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === s
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-4">User</th>
                <th className="p-4">Risk</th>
                <th className="p-4">Method</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Fee</th>
                <th className="p-4">Net</th>
                <th className="p-4">Details</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr><td colSpan={10} className="p-12 text-center text-slate-500">Loading...</td></tr>
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center text-slate-500">No withdrawals found</td></tr>
              ) : withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-medium text-slate-200">{w.user.email}</td>
                  <td className="p-4">
                    <span className={`font-bold ${
                      w.user.riskScore > 70 ? 'text-rose-400' : w.user.riskScore > 40 ? 'text-amber-400' : 'text-slate-400'
                    }`}>{w.user.riskScore}%</span>
                  </td>
                  <td className="p-4 font-medium text-slate-300">{w.method}</td>
                  <td className="p-4 font-extrabold text-rose-400">${safeFloat(w.amount).toFixed(2)}</td>
                  <td className="p-4 text-slate-400">${safeFloat(w.fee || '0').toFixed(2)}</td>
                  <td className="p-4 font-bold text-slate-200">${(safeFloat(w.amount) - safeFloat(w.fee || '0')).toFixed(2)}</td>
                  <td className="p-4 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={JSON.stringify(w.details)}>
                    {w.method === 'PAYPAL' ? w.details.email : w.details.address || w.details.wallet || 'N/A'}
                  </td>
                  <td className="p-4 text-slate-400">{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      w.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : w.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>{w.status}</span>
                  </td>
                  <td className="p-4 text-right">
                    {w.status === 'PENDING' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(w.id)}
                          disabled={actionLoading === w.id}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-3 py-1.5 rounded-lg text-[10px] disabled:opacity-50"
                        >
                          <Check className="w-3 h-3 inline mr-1" />Approve
                        </button>
                        <button
                          onClick={() => setRejectModal(w.id)}
                          disabled={actionLoading === w.id}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/30 font-bold px-3 py-1.5 rounded-lg text-[10px] disabled:opacity-50"
                        >
                          <X className="w-3 h-3 inline mr-1" />Reject
                        </button>
                      </div>
                    )}
                    {w.status !== 'PENDING' && (
                      <span className="text-[10px] text-slate-500 italic">
                        {w.status === 'APPROVED' ? 'Completed' : 'Rejected'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Reject Withdrawal</h3>
            <p className="text-xs text-slate-400">Provide a reason for rejection (visible to the user).</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 min-h-[100px]"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectModal)}
                disabled={!rejectReason.trim() || actionLoading === rejectModal}
                className="bg-rose-500 hover:bg-rose-400 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                Reject Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
