"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Coins, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

interface Offer {
  id: string;
  provider: string;
  name: string;
  description: string;
  payoutAmount: string;
  rewardAmount: string;
}

export default function Offers() {
  const { token, logout } = useAuth();
  const router = useRouter();
  
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clickLoading, setClickLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchOffers = async () => {
      try {
        const res = await fetch('/api/offers', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          logout();
          router.push('/login');
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to load offers');
        }

        const data = await res.json();
        setOffers(data);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffers();
  }, [token, router, logout]);

  const handleStartOffer = async (offerId: string) => {
    setError(null);
    setClickLoading(offerId);

    try {
      const res = await fetch(`/api/tracking/click?offerId=${offerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          // You can also add standard device fingerprint simulation headers here
          'x-device-fingerprint': 'mock_fingerprint_device_123',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to start tracking session. Are you flagged?');
      }

      // Redirect user to ad network tracking endpoint
      window.open(data.targetUrl, '_blank');
    } catch (err: any) {
      setError(err.message || 'Failed to execute redirect');
    } finally {
      setClickLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
          <Coins className="w-8 h-8 text-sky-400" />
          <span>Available Offer Walls</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Complete tasks and surveys below. Rewards will land in your pending balance upon verification.</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm max-w-2xl">
          <p className="font-semibold">Notice:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Grid of Available Offers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="flex flex-col bg-slate-900 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 hover:shadow-lg transition-all duration-300 relative"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="bg-slate-850 border border-slate-750 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                {offer.provider}
              </span>
              <div className="flex items-center gap-1 text-emerald-400 font-extrabold text-lg">
                <Zap className="w-4 h-4 fill-emerald-400" />
                <span>+${parseFloat(offer.rewardAmount).toFixed(2)}</span>
              </div>
            </div>

            <h3 className="text-base font-bold text-white mb-2">{offer.name}</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6 flex-grow">{offer.description}</p>

            <button
              onClick={() => handleStartOffer(offer.id)}
              disabled={clickLoading !== null}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold py-3 px-4 rounded-xl text-xs active:scale-95 disabled:opacity-50 transition-all duration-255"
            >
              {clickLoading === offer.id ? (
                <span>Generating Session...</span>
              ) : (
                <>
                  <span>Start Offer</span>
                  <ExternalLink className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        ))}

        {offers.length === 0 && (
          <div className="col-span-full text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-slate-500 text-sm">No offers are currently active. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
