"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../providers/auth-provider';
import { ShieldAlert, AlertTriangle, Eye, Ban, Check } from 'lucide-react';

interface FraudLog {
  id: string;
  userId: string;
  trigger: string;
  score: number;
  details: Record<string, any>;
  resolved: boolean;
  resolvedBy?: string;
  createdAt: string;
  user: { email: string; riskScore: number; status: string };
}

export default function AdminFraudPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<FraudLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ resolved: resolvedFilter });
      const res = await fetch(`/api/admin/fraud?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load fraud logs');
      setLogs(await res.json());
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [token, resolvedFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleResolve = async (logId: string) => {
    setActionLoading(logId);
    try {
      const res = await fetch(`/api/admin/fraud/${logId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to resolve');
      fetchLogs();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleUserAction = async (userId: string, action: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: action === 'freeze' ? 'FROZEN' : 'SUSPENDED' }),
      });
      if (!res.ok) throw new Error('Action failed');
      fetchLogs();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const triggerLabels: Record<string, string> = {
    VPN_DETECTED: 'VPN Detected',
    VELOCITY_ANOMALY: 'Velocity Anomaly',
    DEVICE_CLONE: 'Device Clone',
    GEO_INCONSISTENCY: 'Geo Inconsistency',
    MULTIPLE_ACCOUNTS: 'Multiple Accounts',
    SUSPICIOUS_CLICK: 'Suspicious Click',
  };

  const triggerColors: Record<string, string> = {
    VPN_DETECTED: 'text-violet-400 bg-violet-500/10',
    VELOCITY_ANOMALY: 'text-amber-400 bg-amber-500/10',
    DEVICE_CLONE: 'text-cyan-400 bg-cyan-500/10',
    GEO_INCONSISTENCY: 'text-rose-400 bg-rose-500/10',
    MULTIPLE_ACCOUNTS: 'text-orange-400 bg-orange-500/10',
    SUSPICIOUS_CLICK: 'text-pink-400 bg-pink-500/10',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fraud Review</h1>
          <p className="text-sm text-slate-400 mt-1">{logs.length} flagged events</p>
        </div>
        <div className="flex gap-2">
          {(['OPEN', 'RESOLVED', 'ALL'] as const).map(s => (
            <button
              key={s}
              onClick={() => setResolvedFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                resolvedFilter === s
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s === 'ALL' ? 'All' : s === 'OPEN' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
            <p className="text-slate-400 text-sm font-medium">No fraud flags</p>
            <p className="text-xs text-slate-500 mt-1">All systems nominal</p>
          </div>
        ) : logs.map((log) => (
          <div key={log.id} className={`bg-slate-900 border rounded-2xl p-5 ${
            log.resolved ? 'border-slate-800 opacity-60' : 'border-rose-500/20'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${triggerColors[log.trigger] || 'text-slate-400 bg-slate-800'}`}>
                    {triggerLabels[log.trigger] || log.trigger}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">{log.user.email}</span>
                  <span className={`text-xs font-bold ${log.score > 70 ? 'text-rose-400' : 'text-amber-400'}`}>
                    +{log.score} pts
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    log.user.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : log.user.status === 'FROZEN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {log.user.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Score: <span className="font-bold text-slate-200">{log.user.riskScore}%</span>
                  {' · '}{new Date(log.createdAt).toLocaleString()}
                  {log.resolved && log.resolvedBy && (
                    <> · Resolved by <span className="font-medium text-sky-400">{log.resolvedBy}</span></>
                  )}
                </p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 bg-slate-950 rounded-xl p-3">
                    <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                  </div>
                )}
              </div>

              {!log.resolved && (
                <div className="flex items-center gap-2 shrink-0">
                  {log.user.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleUserAction(log.userId, 'freeze')}
                      disabled={actionLoading === log.userId}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-900/30 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50"
                    >
                      <AlertTriangle className="w-3 h-3 inline mr-1" />Freeze
                    </button>
                  )}
                  <button
                    onClick={() => handleUserAction(log.userId, 'suspend')}
                    disabled={actionLoading === log.userId}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/30 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50"
                  >
                    <Ban className="w-3 h-3 inline mr-1" />Suspend
                  </button>
                  <button
                    onClick={() => handleResolve(log.id)}
                    disabled={actionLoading === log.id}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50"
                  >
                    <Check className="w-3 h-3 inline mr-1" />Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
