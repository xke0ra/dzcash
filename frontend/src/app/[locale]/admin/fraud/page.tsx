"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import {
  ShieldAlert, AlertTriangle, Ban, Check, RotateCcw, Settings, Eye,
  TrendingUp, Activity, Users, Clock, BrainCircuit, BarChart3,
} from 'lucide-react';

interface FraudLog {
  id: string;
  userId: string;
  triggerType: string;
  score: number;
  details: Record<string, any>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedNote?: string;
  createdAt: string;
  clickId?: string;
  user: { id: string; email: string; riskScore: number; status: string };
}

interface FraudRule {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  weight: number;
  enabled: boolean;
  threshold?: number | null;
  cooldownSec?: number | null;
  totalTriggers: number;
  sustainedCount: number;
  dismissedCount: number;
  currentPrecision: number;
}

interface RuleRecommendation {
  id: string;
  name: string;
  triggerType: string;
  weight: number;
  precision: number;
  totalTriggers: number;
  sustainedRate: number;
  dismissedRate: number;
  recommendation: string;
}

interface FraudAnalytics {
  totalFlags: number;
  resolvedRate: number;
  sustainRate: number;
  activeSuspensions: number;
  activeFreezes: number;
  avgResolutionTime: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  VPN_DETECTED: 'VPN Detected',
  IP_MISMATCH: 'IP Mismatch',
  HIGH_VELOCITY: 'High Velocity',
  DEVICE_FINGERPRINT_CLONE: 'Device Clone',
  GEO_INCONSISTENCY: 'Geo Inconsistency',
  EMAIL_REPUTATION: 'Email Reputation',
  TIME_ANOMALY: 'Time Anomaly',
  CIRCULAR_REFERRAL: 'Circular Referral',
  WITHDRAWAL_VELOCITY: 'Withdrawal Velocity',
  MULTIPLE_ACCOUNTS: 'Multiple Accounts',
  SUSPICIOUS_CLICK: 'Suspicious Click',
  ABNORMAL_PATTERN: 'Abnormal Pattern',
};

const TRIGGER_COLORS: Record<string, string> = {
  VPN_DETECTED: 'text-violet-400 bg-violet-500/10',
  IP_MISMATCH: 'text-blue-400 bg-blue-500/10',
  HIGH_VELOCITY: 'text-amber-400 bg-amber-500/10',
  DEVICE_FINGERPRINT_CLONE: 'text-cyan-400 bg-cyan-500/10',
  GEO_INCONSISTENCY: 'text-rose-400 bg-rose-500/10',
  EMAIL_REPUTATION: 'text-orange-400 bg-orange-500/10',
  TIME_ANOMALY: 'text-purple-400 bg-purple-500/10',
  CIRCULAR_REFERRAL: 'text-pink-400 bg-pink-500/10',
  WITHDRAWAL_VELOCITY: 'text-yellow-400 bg-yellow-500/10',
  MULTIPLE_ACCOUNTS: 'text-red-400 bg-red-500/10',
  SUSPICIOUS_CLICK: 'text-teal-400 bg-teal-500/10',
  ABNORMAL_PATTERN: 'text-indigo-400 bg-indigo-500/10',
};

export default function AdminFraudPage() {
  const { token } = useAuth();
  const te = useTranslations('errors');
  const [logs, setLogs] = useState<FraudLog[]>([]);
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [recommendations, setRecommendations] = useState<RuleRecommendation[]>([]);
  const [analytics, setAnalytics] = useState<FraudAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');
  const [showRules, setShowRules] = useState(false);
  const [showRulesTab, setShowRulesTab] = useState<'rules' | 'recommendations'>('rules');

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (resolvedFilter === 'OPEN') params.set('status', 'open');
      else if (resolvedFilter === 'RESOLVED') params.set('status', 'resolved');
      const res = await fetch(`/api/admin/fraud?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(te('loadFailed', { page: 'fraud logs' }));
      const data = await res.json();
      setLogs(data.logs || data);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [token, resolvedFilter, te]);

  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/fraud/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAnalytics(await res.json());
    } catch {}
  }, [token]);

  const fetchRules = useCallback(async () => {
    if (!token) return;
    try {
      const [rulesRes, recRes] = await Promise.all([
        fetch('/api/admin/fraud/rules', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/fraud/rules/recommendations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (recRes.ok) setRecommendations(await recRes.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchLogs(); fetchAnalytics(); }, [fetchLogs, fetchAnalytics]);

  const handleResolve = async (logId: string, action: 'dismiss' | 'sustain', note?: string) => {
    setActionLoading(logId);
    try {
      const res = await fetch(`/api/admin/fraud/${logId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, notes: note || '' }),
      });
      if (!res.ok) throw new Error(te('actionFailed'));
      fetchLogs();
      fetchAnalytics();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleReverse = async (logId: string) => {
    if (!confirm('Reverse the associated transaction? This will deduct the reward from the user\'s pending balance.')) return;
    setActionLoading(logId);
    try {
      const res = await fetch(`/api/admin/fraud/${logId}/reverse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(te('actionFailed'));
      fetchLogs();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleUserStatus = async (userId: string, status: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(te('actionFailed'));
      fetchLogs();
      fetchAnalytics();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleRuleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/admin/fraud/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      });
      fetchRules();
    } catch {}
  };

  const handleRecomputeBaseline = async (userId: string) => {
    try {
      await fetch(`/api/admin/fraud/recompute-baseline/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const openRules = async () => {
    await fetchRules();
    setShowRules(true);
  };

  const openLogs = logs.filter((l) => !l.resolved);

  const precisionColor = (pct: number) => {
    if (pct >= 70) return 'text-emerald-400';
    if (pct >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fraud Review</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
            <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
            Adaptive scoring engine · {logs.length} events ({openLogs.length} open)
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openRules}
            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
            <Settings className="w-3 h-3" /> Rules
          </button>
          {(['OPEN', 'RESOLVED', 'ALL'] as const).map((s) => (
            <button key={s} onClick={() => setResolvedFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${resolvedFilter === s ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'text-slate-400 hover:text-white'}`}>
              {s === 'ALL' ? 'All' : s === 'OPEN' ? `Open (${openLogs.length})` : 'Resolved'}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Dashboard */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Flags</span>
            </div>
            <span className="text-xl font-bold text-white">{analytics.totalFlags}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Resolved</span>
            </div>
            <span className="text-xl font-bold text-emerald-400">{analytics.resolvedRate}%</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Sustain Rate</span>
            </div>
            <span className="text-xl font-bold text-amber-400">{analytics.sustainRate}%</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Suspended</span>
            </div>
            <span className="text-xl font-bold text-rose-400">{analytics.activeSuspensions}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Avg Resolution</span>
            </div>
            <span className="text-xl font-bold text-purple-400">{analytics.avgResolutionTime}m</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" /> Fraud Detection Rules
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setShowRulesTab('rules')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${showRulesTab === 'rules' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                  Rules
                </button>
                <button onClick={() => setShowRulesTab('recommendations')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${showRulesTab === 'recommendations' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                  ML Recommendations
                </button>
              </div>
            </div>

            {showRulesTab === 'rules' ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Weights auto-adjust based on admin feedback precision. Rules with &gt;70% precision gain weight; &lt;30% lose weight.</p>
                {rules.map((rule) => {
                  const precision = rule.totalTriggers > 0 ? (rule.sustainedCount / rule.totalTriggers) * 100 : 0;
                  const pctColor = precisionColor(precision);
                  return (
                    <div key={rule.id} className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TRIGGER_COLORS[rule.triggerType] || 'text-slate-400 bg-slate-800'}`}>
                            {TRIGGER_LABELS[rule.triggerType] || rule.triggerType}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{rule.name}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={rule.enabled} onChange={(e) => handleRuleToggle(rule.id, e.target.checked)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500" />
                        </label>
                      </div>
                      {rule.description && <p className="text-[10px] text-slate-500 mb-2">{rule.description}</p>}
                      <div className="flex gap-4 text-[10px] text-slate-400 items-center">
                        <span>Weight: <span className="font-bold text-slate-200">{rule.weight}</span></span>
                        {rule.threshold != null && <span>Threshold: <span className="font-bold text-slate-200">{rule.threshold}</span></span>}
                        {rule.cooldownSec != null && <span>Cooldown: <span className="font-bold text-slate-200">{rule.cooldownSec}s</span></span>}
                        {rule.totalTriggers > 0 && (
                          <>
                            <span>Triggers: <span className="font-bold text-slate-200">{rule.totalTriggers}</span></span>
                            <span className={pctColor}>Precision: <span className="font-bold">{precision.toFixed(0)}%</span></span>
                          </>
                        )}
                      </div>
                      {rule.totalTriggers > 0 && (
                        <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${rule.totalTriggers > 0 ? (rule.sustainedCount / rule.totalTriggers) * 100 : 0}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">AI-driven insights based on historical admin decisions. Rules with low precision should be reviewed.</p>
                {recommendations.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">Not enough data yet. Resolve fraud flags to generate recommendations.</p>
                ) : recommendations.map((rec) => {
                  const pctColor = precisionColor(rec.precision);
                  return (
                    <div key={rec.id} className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TRIGGER_COLORS[rec.triggerType] || 'text-slate-400 bg-slate-800'}`}>
                            {TRIGGER_LABELS[rec.triggerType] || rec.triggerType}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{rec.name}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          rec.recommendation === 'Increase weight' ? 'bg-emerald-500/10 text-emerald-400'
                          : rec.recommendation === 'Reduce weight or disable' ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-slate-800 text-slate-300'
                        }`}>{rec.recommendation}</span>
                      </div>
                      <div className="flex gap-4 text-[10px] text-slate-400">
                        <span>Weight: <span className="font-bold text-slate-200">{rec.weight}</span></span>
                        <span className={pctColor}>Precision: <span className="font-bold">{rec.precision}%</span></span>
                        <span>Sustained: <span className="font-bold text-emerald-400">{rec.sustainedRate}%</span></span>
                        <span>Dismissed: <span className="font-bold text-rose-400">{rec.dismissedRate}%</span></span>
                        <span>Samples: <span className="font-bold text-slate-200">{rec.totalTriggers}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => setShowRules(false)}
              className="w-full bg-slate-800 text-slate-300 py-2 rounded-xl text-xs font-medium hover:bg-slate-700">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Fraud Logs */}
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
          <div key={log.id} className={`bg-slate-900 border rounded-2xl p-5 ${log.resolved ? 'border-slate-800 opacity-60' : 'border-rose-500/20'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TRIGGER_COLORS[log.triggerType] || 'text-slate-400 bg-slate-800'}`}>
                    {TRIGGER_LABELS[log.triggerType] || log.triggerType}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">{log.user.email}</span>
                  <span className={`text-xs font-bold ${log.score > 70 ? 'text-rose-400' : 'text-amber-400'}`}>
                    +{log.score} pts
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    log.user.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : log.user.status === 'FROZEN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>{log.user.status}</span>
                  {log.resolved && <span className="text-[10px] text-slate-500">Resolved</span>}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Risk: <span className="font-bold text-slate-200">{log.user.riskScore}%</span>
                  {' · '}{new Date(log.createdAt).toLocaleString()}
                  {log.resolvedBy && <> · by <span className="font-medium text-sky-400">{log.resolvedBy}</span></>}
                  {log.resolvedNote && <> · <span className="text-slate-500">{log.resolvedNote}</span></>}
                </p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-2 bg-slate-950 rounded-xl p-3">
                    <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                  </div>
                )}
              </div>

              {!log.resolved && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {log.user.status === 'ACTIVE' && (
                    <button onClick={() => handleUserStatus(log.userId, 'FROZEN')} disabled={actionLoading === log.userId}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-900/30 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />Freeze
                    </button>
                  )}
                  <button onClick={() => handleUserStatus(log.userId, 'SUSPENDED')} disabled={actionLoading === log.userId}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/30 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50">
                    <Ban className="w-3 h-3 inline mr-1" />Suspend
                  </button>
                  <button onClick={() => handleResolve(log.id, 'sustain')} disabled={actionLoading === log.id}
                    className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-900/30 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />Sustain
                  </button>
                  <button onClick={() => handleResolve(log.id, 'dismiss')} disabled={actionLoading === log.id}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50">
                    <Check className="w-3 h-3 inline mr-1" />Dismiss
                  </button>
                  {log.clickId && (
                    <button onClick={() => handleReverse(log.id)} disabled={actionLoading === log.id}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-900/30 font-bold px-3 py-2 rounded-xl text-[10px] disabled:opacity-50">
                      <RotateCcw className="w-3 h-3 inline mr-1" />Reverse
                    </button>
                  )}
                  <button onClick={() => handleRecomputeBaseline(log.userId)} title="Recompute behavior baseline"
                    className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-900/30 font-bold px-2 py-2 rounded-xl text-[10px]">
                    <BrainCircuit className="w-3 h-3" />
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
