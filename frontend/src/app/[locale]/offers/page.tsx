"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Coins, ExternalLink, Search, Smartphone, Monitor, Tablet, Globe, Filter } from 'lucide-react';
import { safeFloat } from '@/lib/safe-float';
import { useTranslations } from 'next-intl';
import { generateFingerprint } from '@/lib/device-fingerprint';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  _count: { offers: number };
}

interface OfferCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface Offer {
  id: string;
  provider: string;
  name: string;
  description: string;
  payoutAmount: string;
  rewardAmount: string;
  imageUrl?: string;
  category?: OfferCategory | null;
  devices?: string[];
  countries?: string[];
  requirements?: string;
  instructions?: string;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Desktop: <Monitor className="w-3 h-3" />,
  Mobile: <Smartphone className="w-3 h-3" />,
  Tablet: <Tablet className="w-3 h-3" />,
};

export default function Offers() {
  const { token, logout } = useAuth();
  const router = useRouter();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<Offer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clickLoading, setClickLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations('offers');
  const te = useTranslations('errors');

  useEffect(() => {
    generateFingerprint().then(setDeviceFingerprint);
  }, []);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [offersRes, catsRes] = await Promise.all([
          fetch('/api/offers', { headers }),
          fetch('/api/offers/categories', { headers }),
        ]);

        if (offersRes.status === 401) { logout(); router.push('/login'); return; }
        if (!offersRes.ok) throw new Error(te('loadFailed', { page: 'offers' }));

        setOffers(await offersRes.json());
        setCategories(await catsRes.json());
      } catch (err: any) {
        setError(err.message || te('general'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token, router, logout, te]);

  // Filter by category + search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      let result = offers;
      if (selectedCategory) {
        result = result.filter((o) => o.category?.slug === selectedCategory);
      }
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        result = result.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            o.description.toLowerCase().includes(q) ||
            o.provider.toLowerCase().includes(q),
        );
      }
      setFilteredOffers(result);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, offers, selectedCategory]);

  const handleStartOffer = async (offerId: string) => {
    setError(null);
    setClickLoading(offerId);
    try {
      const res = await fetch(`/api/tracking/click?offerId=${offerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-device-fingerprint': deviceFingerprint || 'unknown',
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || te('actionFailed'));
      window.open(data.targetUrl, '_blank');
    } catch (err: any) {
      setError(err.message || te('actionFailed'));
    } finally {
      setClickLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -z-10" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
          <Coins className="w-8 h-8 text-sky-400" />
          <span>{t('title')}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Search + Filter row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors text-sm"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
            !selectedCategory
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          {t('all')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.slug === selectedCategory ? null : cat.slug)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
              selectedCategory === cat.slug
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
            <span className="text-[10px] opacity-60">({cat._count.offers})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm max-w-2xl">
          <p className="font-semibold">Notice:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Offer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOffers.map((offer) => (
          <div key={offer.id} className="flex flex-col bg-slate-900 border border-slate-800/80 rounded-2xl hover:border-slate-700 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
            {/* Header image area */}
            <div className="h-24 bg-gradient-to-br from-slate-800 to-slate-850 relative overflow-hidden flex items-end p-4">
              {offer.imageUrl && (
                <img src={offer.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              )}
              <div className="relative z-10 flex items-center gap-2 w-full">
                <span className="bg-slate-950/80 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-slate-700/50">
                  {offer.provider}
                </span>
                {offer.category && (
                  <span className="bg-slate-950/80 text-slate-400 text-[10px] px-2 py-1 rounded border border-slate-700/50">
                    {offer.category.icon} {offer.category.name}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1 text-emerald-400 font-extrabold text-lg">
                  <Coins className="w-4 h-4 fill-emerald-400" />
                  <span>+${safeFloat(offer.rewardAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-col flex-grow">
              <h3 className="text-base font-bold text-white mb-1">{offer.name}</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-3 flex-grow">{offer.description}</p>

              {/* Devices & Countries */}
              <div className="flex flex-wrap gap-2 mb-3">
                {offer.devices?.map((d) => (
                  <span key={d} className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded">
                    {DEVICE_ICONS[d] || null}
                    {d}
                  </span>
                ))}
                {offer.countries && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded">
                    <Globe className="w-3 h-3" />
                    {offer.countries.slice(0, 2).join(', ')}{offer.countries.length > 2 ? '...' : ''}
                  </span>
                )}
              </div>

              {offer.requirements && (
                <p className="text-[10px] text-amber-400/70 mb-3 leading-relaxed">{offer.requirements}</p>
              )}

              <button
                onClick={() => handleStartOffer(offer.id)}
                disabled={clickLoading !== null}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold py-3 px-4 rounded-xl text-xs active:scale-95 disabled:opacity-50 transition-all duration-255"
              >
                {clickLoading === offer.id ? (
                  <span>Generating Session...</span>
                ) : (
                  <>
                    <span>{t('start')}</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {filteredOffers.length === 0 && (
          <div className="col-span-full text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-slate-500 text-sm">{t('noOffers')} {t('checkBackLater')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
