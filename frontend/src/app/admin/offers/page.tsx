"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../providers/auth-provider';
import { Plus, Edit2, Trash2, ExternalLink, RefreshCw } from 'lucide-react';

interface AdminOffer {
  id: string;
  title: string;
  provider: string;
  payout: string;
  currency: string;
  category: string;
  status: string;
  offerId: string;
  imageUrl?: string;
  requirements: string;
  link: string;
  totalClicks: number;
  totalConversions: number;
  createdAt: string;
}

interface OfferForm {
  title: string;
  provider: string;
  payout: string;
  currency: string;
  category: string;
  requirements: string;
  link: string;
  imageUrl: string;
  offerId: string;
}

const emptyForm: OfferForm = {
  title: '', provider: 'CPX', payout: '', currency: 'USD',
  category: 'survey', requirements: '', link: '', imageUrl: '', offerId: '',
};

export default function AdminOffersPage() {
  const { token } = useAuth();
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [syncing, setSyncing] = useState(false);

  const fetchOffers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/offers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load offers');
      setOffers(await res.json());
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/offers/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Sync failed');
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(isEdit ? 'Update failed' : 'Create failed');
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchOffers();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const handleEdit = (offer: AdminOffer) => {
    setForm({
      title: offer.title,
      provider: offer.provider,
      payout: offer.payout,
      currency: offer.currency,
      category: offer.category,
      requirements: offer.requirements,
      link: offer.link,
      imageUrl: offer.imageUrl || '',
      offerId: offer.offerId,
    });
    setEditingId(offer.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this offer permanently?')) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/offers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchOffers();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const totalPayout = offers.reduce((s, o) => s + parseFloat(o.payout || '0'), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Offer Management</h1>
          <p className="text-sm text-slate-400 mt-1">{offers.length} offers · Total payout: <span className="text-sky-400 font-bold">${totalPayout.toFixed(2)}</span></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            Sync Offers
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
            className="bg-sky-500 hover:bg-sky-400 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Add Offer
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm">{error}</div>
      )}

      {/* Offer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">{editingId ? 'Edit Offer' : 'Create Offer'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Provider</label>
                <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50">
                  <option value="CPX">CPX</option>
                  <option value="OFFERTORO">OfferToro</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50">
                  <option value="survey">Survey</option>
                  <option value="video">Video</option>
                  <option value="download">Download</option>
                  <option value="offer">Offer</option>
                  <option value="game">Game</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Payout</label>
                <input type="number" step="0.01" value={form.payout} onChange={e => setForm(f => ({ ...f, payout: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Offer ID</label>
                <input value={form.offerId} onChange={e => setForm(f => ({ ...f, offerId: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Requirements</label>
                <textarea value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50 min-h-[60px]" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Link</label>
                <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Image URL</label>
                <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium hover:bg-slate-700">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={actionLoading === 'form' || !form.title || !form.payout}
                className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {editingId ? 'Update Offer' : 'Create Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <th className="p-4">Title</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Category</th>
                <th className="p-4">Payout</th>
                <th className="p-4">Clicks</th>
                <th className="p-4">Conversions</th>
                <th className="p-4">CR</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {isLoading ? (
                <tr><td colSpan={9} className="p-12 text-center text-slate-500">Loading...</td></tr>
              ) : offers.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-slate-500">No offers found</td></tr>
              ) : offers.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{o.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{o.offerId}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{o.provider}</span>
                  </td>
                  <td className="p-4 text-slate-300 capitalize">{o.category}</td>
                  <td className="p-4 font-bold text-emerald-400">${parseFloat(o.payout).toFixed(2)}</td>
                  <td className="p-4 text-slate-300">{o.totalClicks}</td>
                  <td className="p-4 text-slate-300">{o.totalConversions}</td>
                  <td className="p-4">
                    <span className="font-bold text-sky-400">
                      {o.totalClicks > 0 ? ((o.totalConversions / o.totalClicks) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      o.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                    }`}>{o.status}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {o.link && (
                        <a href={o.link} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-sky-400">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button onClick={() => handleEdit(o)} className="text-slate-500 hover:text-sky-400">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(o.id)} className="text-slate-500 hover:text-rose-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
