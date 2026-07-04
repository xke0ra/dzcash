"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import { Plus, Edit2, ExternalLink, RefreshCw, Layers } from 'lucide-react';
import { safeFloat } from '@/lib/safe-float';

interface OfferCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  _count: { offers: number };
}

interface Offer {
  id: string;
  provider: string;
  providerId: string;
  name: string;
  description: string;
  payoutAmount: string;
  rewardAmount: string;
  status: boolean;
  targetUrl: string;
  imageUrl?: string;
  category?: OfferCategory | null;
  categoryId?: string | null;
  countries?: string[];
  devices?: string[];
  requirements?: string;
  instructions?: string;
  createdAt: string;
  _count: { clicks: number };
}

interface OfferForm {
  provider: string;
  providerId: string;
  name: string;
  description: string;
  payoutAmount: string;
  rewardAmount: string;
  targetUrl: string;
  status: boolean;
  categoryId: string;
  imageUrl: string;
  countries: string;
  devices: string[];
  requirements: string;
  instructions: string;
}

interface SyncStatus {
  provider: string;
  status: string;
  lastSyncAt: string | null;
  offersFound: number;
  offersAdded: number;
  offersUpdated: number;
  offersRemoved: number;
  errorMessage: string | null;
}

const emptyForm: OfferForm = {
  provider: 'GENERIC',
  providerId: '',
  name: '',
  description: '',
  payoutAmount: '',
  rewardAmount: '',
  targetUrl: '',
  status: true,
  categoryId: '',
  imageUrl: '',
  countries: '',
  devices: ['Desktop', 'Mobile'],
  requirements: '',
  instructions: '',
};

const PROVIDERS = ['CPX', 'OFFERTORO', 'GENERIC', 'ADGATE_MEDIA', 'KIWIWALL', 'PERSONA', 'REVSHARE', 'MONETIZER', 'OFFERFLOOD', 'ADWALL', 'TIME_WALL', 'SURVEY_SPOT', 'OFFER_ENGINE', 'ADWORKSHUB', 'REVENUE_UNIT', 'OFFER_YE', 'MONETAG'];

export default function AdminOffersPage() {
  const { token } = useAuth();
  const te = useTranslations('errors');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOffers = useCallback(async () => {
    if (!token) return;
    try {
      const [offersRes, catsRes, syncRes] = await Promise.all([
        fetch(`/api/admin/offers?page=${page}&limit=25`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/offers/sync-status', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!offersRes.ok) throw new Error(te('loadFailed', { page: 'offers' }));
      const data = await offersRes.json();
      setOffers(data.offers || data);
      setTotalPages(data.totalPages || 1);
      if (catsRes.ok) setCategories(await catsRes.json());
      if (syncRes.ok) setSyncStatuses(await syncRes.json());
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [token, page, te]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/offers/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(te('loadFailed', { page: 'offers' }));
      fetchOffers();
    } catch (err: any) { alert(err.message); }
    finally { setSyncing(false); }
  };

  const handleSubmit = async () => {
    setActionLoading('form');
    try {
      const isEdit = !!editingId;
      const url = isEdit ? `/api/admin/offers/${editingId}` : '/api/admin/offers';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: any = {
        provider: form.provider,
        providerId: form.providerId,
        name: form.name,
        description: form.description,
        payoutAmount: safeFloat(form.payoutAmount),
        rewardAmount: safeFloat(form.rewardAmount),
        targetUrl: form.targetUrl,
        status: form.status,
        categoryId: form.categoryId || undefined,
        imageUrl: form.imageUrl || undefined,
        countries: form.countries ? form.countries.split(',').map((c) => c.trim()).filter(Boolean) : undefined,
        devices: form.devices.length > 0 ? form.devices : undefined,
        requirements: form.requirements || undefined,
        instructions: form.instructions || undefined,
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(isEdit ? te('loadFailed', { page: 'offer' }) : te('loadFailed', { page: 'offer' }));
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchOffers();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleEdit = (offer: Offer) => {
    setForm({
      provider: offer.provider,
      providerId: offer.providerId,
      name: offer.name,
      description: offer.description,
      payoutAmount: offer.payoutAmount,
      rewardAmount: offer.rewardAmount,
      targetUrl: offer.targetUrl,
      status: offer.status,
      categoryId: offer.categoryId || '',
      imageUrl: offer.imageUrl || '',
      countries: offer.countries?.join(', ') || '',
      devices: offer.devices || ['Desktop', 'Mobile'],
      requirements: offer.requirements || '',
      instructions: offer.instructions || '',
    });
    setEditingId(offer.id);
    setShowForm(true);
  };

  const handleToggle = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/offers/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchOffers();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const categoryOptions = categories.map((c) => (
    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
  ));

  const totalReward = offers.reduce((s, o) => s + safeFloat(o.rewardAmount), 0);
  const totalClicks = offers.reduce((s, o) => s + (o._count?.clicks || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Offer Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            {offers.length} offers · Total reward: <span className="text-emerald-400 font-bold">${totalReward.toFixed(2)}</span>
            · Total clicks: <span className="text-sky-400 font-bold">{totalClicks}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSync} disabled={syncing}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 flex items-center gap-2">
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            Sync All ({PROVIDERS.length})
          </button>
          <button onClick={() => { setShowCategories(true); }}
            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2">
            <Layers className="w-3 h-3" />
            Categories
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
            className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2">
            <Plus className="w-3 h-3" />
            Add Offer
          </button>
        </div>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>}

      {/* Sync Status */}
      {syncStatuses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {syncStatuses.map((s) => (
            <div key={s.provider} className={`bg-slate-900 border rounded-xl p-3 text-xs ${
              s.status === 'error' ? 'border-rose-500/20' : 'border-slate-800'
            }`}>
              <p className="font-bold text-slate-200 mb-1">{s.provider}</p>
              <p className={`text-[10px] ${s.status === 'error' ? 'text-rose-400' : 'text-slate-400'}`}>
                {s.status === 'idle' ? '✓ Synced' : s.status === 'error' ? '✗ Error' : s.status}
              </p>
              {s.lastSyncAt && <p className="text-[9px] text-slate-500 mt-1">{new Date(s.lastSyncAt).toLocaleDateString()}</p>}
              <p className="text-[9px] text-slate-500">+{s.offersAdded} ~{s.offersUpdated} -{s.offersRemoved}</p>
            </div>
          ))}
        </div>
      )}

      {/* Offer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">{editingId ? 'Edit Offer' : 'Create Offer'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50 min-h-[60px]" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Provider</label>
                <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50">
                  {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Provider ID</label>
                <input value={form.providerId} onChange={e => setForm(f => ({ ...f, providerId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Reward Amount ($)</label>
                <input type="number" step="0.01" value={form.rewardAmount} onChange={e => setForm(f => ({ ...f, rewardAmount: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Payout Amount ($)</label>
                <input type="number" step="0.01" value={form.payoutAmount} onChange={e => setForm(f => ({ ...f, payoutAmount: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Target URL</label>
                <input value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50">
                  <option value="">No category</option>
                  {categoryOptions}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Status</label>
                <select value={form.status ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, status: e.target.value === 'active' }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Image URL</label>
                <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Countries (comma-separated, e.g. US, GB, CA)</label>
                <input value={form.countries} onChange={e => setForm(f => ({ ...f, countries: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Devices</label>
                <div className="flex gap-3">
                  {['Desktop', 'Mobile', 'Tablet'].map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs text-slate-300">
                      <input type="checkbox" checked={form.devices.includes(d)}
                        onChange={() => setForm(f => ({
                          ...f,
                          devices: f.devices.includes(d) ? f.devices.filter((x) => x !== d) : [...f.devices, d],
                        }))}
                        className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500" />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Requirements</label>
                <textarea value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50 min-h-[60px]" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Instructions</label>
                <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50 min-h-[60px]" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium hover:bg-slate-700">Cancel</button>
              <button onClick={handleSubmit} disabled={actionLoading === 'form' || !form.name || !form.rewardAmount}
                className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50">
                {editingId ? 'Update Offer' : 'Create Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {showCategories && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Categories</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between bg-slate-950 rounded-xl px-4 py-3 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-200">{cat.name}</p>
                      <p className="text-[10px] text-slate-500">{cat._count.offers} offers</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowCategories(false)}
              className="w-full bg-slate-800 text-slate-300 py-2 rounded-xl text-xs font-medium hover:bg-slate-700">Close</button>
          </div>
        </div>
      )}

      {/* Offers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-4">Name</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Category</th>
                <th className="p-4">Reward</th>
                <th className="p-4">Clicks</th>
                <th className="p-4">CR</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-500">Loading...</td></tr>
              ) : offers.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-500">No offers found. Click &ldquo;Sync All&rdquo; or &ldquo;Add Offer&rdquo;.</td></tr>
              ) : offers.map((o) => {
                const clicks = o._count?.clicks || 0;
                const conv = 0;
                return (
                  <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-slate-200">{o.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex gap-2">
                        <span>ID: {o.providerId}</span>
                        {o.devices && <span>{o.devices.join(', ')}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{o.provider}</span>
                    </td>
                    <td className="p-4 text-slate-300">{o.category?.icon} {o.category?.name || '-'}</td>
                    <td className="p-4 font-bold text-emerald-400">${safeFloat(o.rewardAmount).toFixed(2)}</td>
                    <td className="p-4 text-slate-300">{clicks}</td>
                    <td className="p-4">
                      <span className="font-bold text-sky-400">{clicks > 0 ? ((conv / clicks) * 100).toFixed(1) : '0.0'}%</span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        o.status ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                      }`}>{o.status ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleToggle(o.id)} disabled={actionLoading === o.id}
                          className={`text-[10px] font-bold px-2 py-1 rounded ${o.status ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
                          {o.status ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleEdit(o)} className="text-slate-500 hover:text-sky-400">
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${page === p ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
