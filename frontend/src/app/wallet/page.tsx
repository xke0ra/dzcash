"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/auth-provider';
import { useRouter } from 'next/navigation';
import { DollarSign, Clock, CheckCircle, HelpCircle, AlertCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface Balance {
  pendingBalance: number;
  availableBalance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  notes: string;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  method: string;
  status: string;
  amount: string;
  details: Record<string, any>;
  createdAt: string;
}

export default function WalletPage() {
  const { token, logout } = useAuth();
  const router = useRouter();

  const [balances, setBalances] = useState<Balance>({ pendingBalance: 0, availableBalance: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Withdrawal Form States
  const [method, setMethod] = useState<'PAYPAL' | 'CRYPTO'>('PAYPAL');
  const [amount, setAmount] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [cryptoAddress, setCryptoAddress] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [balanceRes, txRes, wRes] = await Promise.all([
        fetch('/api/wallet/balance', { headers }),
        fetch('/api/wallet/transactions', { headers }),
        fetch('/api/wallet/withdrawals', { headers }),
      ]);

      if (balanceRes.status === 401) {
        logout();
        router.push('/login');
        return;
      }

      const balanceData = await balanceRes.json();
      const txData = await txRes.json();
      const wData = await wRes.json();

      setBalances(balanceData);
      setTransactions(txData);
      setWithdrawals(wData);
    } catch (e) {
      console.error('Failed to load wallet data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [token, router]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount < 1.00) {
      setFormError('Minimum withdrawal amount is $1.00');
      return;
    }

    if (withdrawAmount > balances.availableBalance) {
      setFormError('Insufficient available balance');
      return;
    }

    let details: Record<string, any> = {};
    if (method === 'PAYPAL') {
      if (!paypalEmail) {
        setFormError('Please enter a valid PayPal email address');
        return;
      }
      details = { email: paypalEmail };
    } else {
      if (!cryptoAddress) {
        setFormError('Please enter a valid USDT TRC20 destination wallet');
        return;
      }
      details = { address: cryptoAddress, chain: 'TRC20' };
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          method,
          amount: withdrawAmount,
          details,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit withdrawal request');
      }

      setFormSuccess('Withdrawal request submitted successfully and is pending admin approval.');
      setAmount('');
      setPaypalEmail('');
      setCryptoAddress('');
      
      // Refresh user balances and histories
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to request withdrawal');
    } finally {
      setIsSubmitting(false);
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
      {/* Wallet Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between hover:border-emerald-500/20 transition-all duration-300">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Balance</p>
            <h3 className="text-3xl font-extrabold text-emerald-400">${balances.availableBalance.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 font-medium">Unlocked funds ready for cashout</p>
          </div>
          <div className="bg-emerald-500/10 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-400">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between hover:border-sky-500/20 transition-all duration-300">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Balance</p>
            <h3 className="text-3xl font-extrabold text-sky-400">${balances.pendingBalance.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 font-medium">Locked coins undergoing safety check</p>
          </div>
          <div className="bg-sky-500/10 w-14 h-14 rounded-2xl flex items-center justify-center text-sky-400">
            <Clock className="w-7 h-7" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Withdrawal Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 lg:col-span-1">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">Request Cashout</h3>

          {formError && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Withdrawal Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('PAYPAL')}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                    method === 'PAYPAL'
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                  }`}
                >
                  PayPal
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('CRYPTO')}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                    method === 'CRYPTO'
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                  }`}
                >
                  USDT TRC20
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount (USD)</label>
              <input
                type="number"
                step="0.01"
                min="1.00"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            {method === 'PAYPAL' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">PayPal Email Address</label>
                <input
                  type="email"
                  required
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="name@email.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Crypto Address (USDT TRC20)</label>
                <input
                  type="text"
                  required
                  value={cryptoAddress}
                  onChange={(e) => setCryptoAddress(e.target.value)}
                  placeholder="T..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-500 text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-sky-400 disabled:opacity-50 text-sm transition-all mt-4"
            >
              {isSubmitting ? 'Processing request...' : 'Confirm Cashout'}
            </button>
          </form>
        </div>

        {/* Transaction History & Payout Status Columns */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-8">
          {/* Withdrawal status list */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">Withdrawal Requests</h3>
            
            {withdrawals.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No cashout requests found.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-60 pr-1">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex justify-between items-center bg-slate-950 p-4 border border-slate-850 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-200">{w.method === 'PAYPAL' ? 'PayPal Payout' : 'USDT TRC20 Crypto'}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{new Date(w.createdAt).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        {w.method === 'PAYPAL' ? w.details.email : `${w.details.address.substring(0, 8)}...`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-rose-400">-${parseFloat(w.amount).toFixed(2)}</p>
                      <span className={`inline-block mt-2 text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                        w.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : w.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {w.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ledger transactions logs list */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">Ledger Statement</h3>
            
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No transactions found.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-60 pr-1">
                {transactions.map((t) => {
                  const isNegative = t.type === 'WITHDRAWAL' || t.type === 'FRAUD_REVERSAL';
                  return (
                    <div key={t.id} className="flex justify-between items-center bg-slate-950 p-4 border border-slate-850 rounded-xl">
                      <div className="flex items-center gap-3">
                        {isNegative ? (
                          <ArrowUpCircle className="w-5 h-5 text-rose-400" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5 text-emerald-400" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-200">{t.notes || t.type}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{new Date(t.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-extrabold ${isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isNegative ? '-' : '+'}${parseFloat(t.amount).toFixed(2)}
                        </p>
                        <span className={`inline-block mt-1 text-[8px] font-bold uppercase ${
                          t.status === 'COMPLETED'
                            ? 'text-emerald-400'
                            : t.status === 'PENDING'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
