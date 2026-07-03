"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import { Search, ChevronDown, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { safeFloat } from '@/lib/safe-float';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: string;
  riskScore: number;
  totalEarned: string;
  totalWithdrawn: string;
  createdAt: string;
  wallet?: {
    pendingBalance: string;
    availableBalance: string;
  };
}

type SortKey = 'email' | 'status' | 'riskScore' | 'totalEarned' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function AdminUsersPage() {
  const { token } = useAuth();
  const t = useTranslations('errors');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        search,
        status: statusFilter,
        sortKey,
        sortDir,
      });
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(t('loadFailed', { page: 'users' }));
      const data = await res.json();
      setUsers(data.users ?? data);
      setTotal(data.total ?? data.length ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, page, search, statusFilter, sortKey, sortDir]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAction = async (userId: string, action: string, body?: Record<string, unknown>) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(t('actionFailed'));
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return <ChevronDown className={`w-3 h-3 inline ml-1 ${sortDir === 'asc' ? 'rotate-180' : ''}`} />;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      FROZEN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      SUSPENDED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${styles[status] || 'bg-slate-800 text-slate-400'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-sm text-slate-400 mt-1">{total} total users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by email..."
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); }}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-sky-500/50"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="FROZEN">Frozen</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('email')}>
                  Email <SortIcon columnKey="email" />
                </th>
                <th className="p-4">Role</th>
                <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('status')}>
                  Status <SortIcon columnKey="status" />
                </th>
                <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('riskScore')}>
                  Risk <SortIcon columnKey="riskScore" />
                </th>
                <th className="p-4">Balance</th>
                <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('totalEarned')}>
                  Earned <SortIcon columnKey="totalEarned" />
                </th>
                <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('createdAt')}>
                  Registered <SortIcon columnKey="createdAt" />
                </th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-500">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-500">No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 font-medium text-slate-200">{u.email}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      u.role === 'SUPER_ADMIN' ? 'bg-violet-500/10 text-violet-400' : 'bg-sky-500/10 text-sky-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4"><StatusBadge status={u.status} /></td>
                  <td className="p-4">
                    <span className={`font-bold ${
                      u.riskScore > 70 ? 'text-rose-400' : u.riskScore > 40 ? 'text-amber-400' : 'text-slate-400'
                    }`}>
                      {u.riskScore}%
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-200 font-medium">${safeFloat(u.wallet?.availableBalance || '0').toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">{safeFloat(u.wallet?.pendingBalance || '0').toFixed(2)} pending</div>
                  </td>
                  <td className="p-4 font-medium text-emerald-400">${safeFloat(u.totalEarned || '0').toFixed(2)}</td>
                  <td className="p-4 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.status !== 'SUSPENDED' && (
                        <button
                          onClick={() => handleAction(u.id, 'status', { status: 'SUSPENDED' })}
                          disabled={actionLoading === u.id}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900/30 font-bold px-2.5 py-1.5 rounded-lg text-[10px] disabled:opacity-50"
                        >
                          <ShieldAlert className="w-3 h-3 inline mr-1" />Suspend
                        </button>
                      )}
                      {u.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleAction(u.id, 'status', { status: 'ACTIVE' })}
                          disabled={actionLoading === u.id}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-2.5 py-1.5 rounded-lg text-[10px] disabled:opacity-50"
                        >
                          <ShieldCheck className="w-3 h-3 inline mr-1" />Activate
                        </button>
                      )}
                      {u.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAction(u.id, 'status', { status: 'FROZEN' })}
                          disabled={actionLoading === u.id}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-900/30 font-bold px-2.5 py-1.5 rounded-lg text-[10px] disabled:opacity-50"
                        >
                          <Shield className="w-3 h-3 inline mr-1" />Freeze
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total / pageSize)}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 hover:border-slate-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 hover:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
