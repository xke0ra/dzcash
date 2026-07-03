"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DollarSign, Clock, CheckCircle, HelpCircle, AlertCircle, ArrowDownCircle, ArrowUpCircle, PiggyBank } from 'lucide-react';
import { safeFloat } from '@/lib/safe-float';

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
  fee: string;
  netAmount: string;
  autoApproved?: boolean;
  details: Record<string, any>;
  createdAt: string;
}

interface WithdrawalMethodInfo {
  method: string;
  label: string;
  minAmount: number;
  fee: { percent: number; fixed: number };
}

interface FeeEstimate {
  fee: number;
  netAmount: number;
}

interface Schedule {
  id?: string;
  method: string;
  details: Record<string, any>;
  threshold: string;
  enabled: boolean;
}

const METHOD_ICONS: Record<string, string> = {
  PAYPAL: '\u{1F4B3}',
  CRYPTO: '\u20BF',
  USDT_TRC20: '\u{1F48E}',
  GIFT_CARD: '\u{1F381}',
  GIFT_CARD_AMAZON: '\u{1F4E6}',
  GIFT_CARD_GOOGLE_PLAY: '\u25B6\uFE0F',
  MOBILE_MONEY: '\u{1F4F1}',
};

function WithdrawMethodFields({ method, values, onChange }: {
  method: string;
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const t = useTranslations('wallet');

  switch (method) {
    case 'PAYPAL':
      return (
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('paypalEmail')}</label>
          <input type="email" required value={values.email || ''} onChange={(e) => onChange('email', e.target.value)}
            placeholder="name@email.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500" />
        </div>
      );
    case 'CRYPTO':
      return (
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('cryptoAddress')}</label>
          <input type="text" required value={values.address || ''} onChange={(e) => onChange('address', e.target.value)}
            placeholder="0x..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm font-mono focus:outline-none focus:border-sky-500" />
        </div>
      );
    case 'USDT_TRC20':
      return (
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('usdtTrc20Address')}</label>
          <input type="text" required value={values.address || ''} onChange={(e) => onChange('address', e.target.value)}
            placeholder="T..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm font-mono focus:outline-none focus:border-sky-500" />
        </div>
      );
    case 'GIFT_CARD_AMAZON':
    case 'GIFT_CARD_GOOGLE_PLAY':
    case 'GIFT_CARD':
      return (
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('giftCardEmail')}</label>
          <input type="email" required value={values.email || ''} onChange={(e) => onChange('email', e.target.value)}
            placeholder="name@email.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500" />
        </div>
      );
    case 'MOBILE_MONEY':
      return (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('mobileMoneyProvider')}</label>
            <select required value={values.provider || ''} onChange={(e) => onChange('provider', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-sky-500">
              <option value="">Select provider</option>
              <option value="MPESA">M-Pesa</option>
              <option value="ORANGE_MONEY">Orange Money</option>
              <option value="MTN_MONEY">MTN Mobile Money</option>
              <option value="AIRTEL_MONEY">Airtel Money</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('mobileMoneyNumber')}</label>
            <input type="tel" required value={values.number || ''} onChange={(e) => onChange('number', e.target.value)}
              placeholder="+254712345678"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500" />
          </div>
        </>
      );
    default:
      return null;
  }
}

export default function WalletPage() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations('wallet');
  const te = useTranslations('errors');

  const [balances, setBalances] = useState<Balance>({ pendingBalance: 0, availableBalance: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [methods, setMethods] = useState<WithdrawalMethodInfo[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'withdraw' | 'schedule'>('withdraw');

  // Withdrawal form
  const [method, setMethod] = useState<string>('PAYPAL');
  const [amount, setAmount] = useState('');
  const [withdrawDetails, setWithdrawDetails] = useState<Record<string, string>>({});
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const feeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Schedule form
  const [schedMethod, setSchedMethod] = useState('PAYPAL');
  const [schedThreshold, setSchedThreshold] = useState('10');
  const [schedDetails, setSchedDetails] = useState<Record<string, string>>({});

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [balanceRes, txRes, wRes, methodsRes, schedRes] = await Promise.all([
        fetch('/api/wallet/balance', { headers }),
        fetch('/api/wallet/transactions', { headers }),
        fetch('/api/wallet/withdrawals', { headers }),
        fetch('/api/wallet/methods', { headers }),
        fetch('/api/wallet/schedule', { headers }),
      ]);
      if (balanceRes.status === 401) { logout(); router.push('/login'); return; }
      setBalances(await balanceRes.json());
      setTransactions(await txRes.json());
      setWithdrawals(await wRes.json());
      setMethods(await methodsRes.json());
      const s = await schedRes.json();
      setSchedule(s);
      if (s) {
        setSchedMethod(s.method);
        setSchedThreshold(s.threshold);
        setSchedDetails({...s.details});
      }
    } catch (e) {
      console.error('Failed to load wallet data', e);
    } finally {
      setIsLoading(false);
    }
  }, [token, logout, router]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, [token, router, fetchData]);

  // Fee estimate with debounce
  useEffect(() => {
    if (feeTimeoutRef.current) clearTimeout(feeTimeoutRef.current);
    const amt = safeFloat(amount);
    if (isNaN(amt) || amt <= 0) { setFeeEstimate(null); return; }
    feeTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wallet/fee-estimate?method=${method}&amount=${amt}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setFeeEstimate(await res.json());
      } catch { /* ignore */ }
    }, 300);
    return () => { if (feeTimeoutRef.current) clearTimeout(feeTimeoutRef.current); };
  }, [method, amount, token]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const amt = safeFloat(amount);
    if (isNaN(amt) || amt < 0.01) { setFormError('Minimum withdrawal amount is $0.01'); return; }
    if (amt > balances.availableBalance) { setFormError('Insufficient available balance'); return; }
    if (Object.values(withdrawDetails).some((v) => !v)) { setFormError('Please fill in all required fields'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ method, amount: amt, details: withdrawDetails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || te('submissionFailed'));

      setFormSuccess(data.autoApproved
        ? `Withdrawal of $${amt.toFixed(2)} approved automatically! Fee: $${data.fee.toFixed(2)}. You receive: $${data.netAmount.toFixed(2)}.`
        : 'Withdrawal request submitted successfully and is pending review.');
      setAmount('');
      setWithdrawDetails({});
      setFeeEstimate(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to request withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const threshold = safeFloat(schedThreshold);
    if (isNaN(threshold) || threshold < 1) { setFormError('Minimum threshold is $1.00'); return; }
    if (Object.values(schedDetails).some((v) => !v)) { setFormError('Please fill in all required fields'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/wallet/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ method: schedMethod, threshold, details: schedDetails, enabled: true }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to save schedule');
      setFormSuccess(t('scheduleSaved'));
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleDelete = async () => {
    try {
      await fetch('/api/wallet/schedule/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormSuccess(t('scheduleRemoved'));
      setSchedule(null);
      fetchData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const clearMessages = () => { setFormError(null); setFormSuccess(null); };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400" />
      </div>
    );
  }

  const currentMethod = methods.find((m) => m.method === method);

  return (
    <div className="space-y-8">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between hover:border-emerald-500/20 transition-all duration-300">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('availableBalance')}</p>
            <h3 className="text-3xl font-extrabold text-emerald-400">${balances.availableBalance.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 font-medium">{t('availableBalanceDesc')}</p>
          </div>
          <div className="bg-emerald-500/10 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-400">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between hover:border-sky-500/20 transition-all duration-300">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('pendingBalance')}</p>
            <h3 className="text-3xl font-extrabold text-sky-400">${balances.pendingBalance.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 font-medium">{t('pendingBalanceDesc')}</p>
          </div>
          <div className="bg-sky-500/10 w-14 h-14 rounded-2xl flex items-center justify-center text-sky-400">
            <Clock className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button onClick={() => { setActiveTab('withdraw'); clearMessages(); }}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'withdraw' ? 'text-sky-400 border-sky-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
          <DollarSign className="w-4 h-4 inline mr-1.5" />{t('withdrawButton')}
        </button>
        <button onClick={() => { setActiveTab('schedule'); clearMessages(); }}
          className={`pb-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'schedule' ? 'text-sky-400 border-sky-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
          <PiggyBank className="w-4 h-4 inline mr-1.5" />{t('schedulingTitle')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form column */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 lg:col-span-1">
          {activeTab === 'withdraw' ? (
            <>
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">{t('withdrawButton')}</h3>

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

              <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3 rounded-lg text-xs">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('autoApproveInfo')}</span>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('selectMethod')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map((m) => (
                      <button key={m.method} type="button" onClick={() => { setMethod(m.method); setWithdrawDetails({}); }}
                        className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${method === m.method ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'}`}>
                        <span className="mr-1">{METHOD_ICONS[m.method] || ''}</span>{m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('amount')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                    <input type="number" step="0.01" min="0.01" required value={amount}
                      onChange={(e) => setAmount(e.target.value)} placeholder="0.01"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-8 pr-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500" />
                  </div>
                </div>

                <WithdrawMethodFields method={method} values={withdrawDetails}
                  onChange={(key, val) => setWithdrawDetails((prev) => ({ ...prev, [key]: val }))} />

                {feeEstimate && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{t('feeEstimate')}</span>
                      <span className="text-rose-400 font-bold">-${feeEstimate.fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{t('youReceive')}</span>
                      <span className="text-emerald-400 font-bold">${feeEstimate.netAmount.toFixed(2)}</span>
                    </div>
                    {currentMethod && (
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{t('fee')}</span>
                        <span>{currentMethod.fee.percent}% + ${currentMethod.fee.fixed.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-sky-500 text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-sky-400 disabled:opacity-50 text-sm transition-all mt-4">
                  {isSubmitting ? t('processing') : t('withdraw')}
                </button>
              </form>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">{t('schedulingTitle')}</h3>
              <p className="text-xs text-slate-400">{t('schedulingDesc')}</p>

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

              <form onSubmit={handleScheduleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('scheduleMethod')}</label>
                  <select value={schedMethod} onChange={(e) => { setSchedMethod(e.target.value); setSchedDetails({}); }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-sky-500">
                    {methods.map((m) => <option key={m.method} value={m.method}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('scheduleThreshold')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                    <input type="number" step="0.01" min="1.00" required value={schedThreshold}
                      onChange={(e) => setSchedThreshold(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-8 pr-4 text-white placeholder-slate-700 text-sm focus:outline-none focus:border-sky-500" />
                  </div>
                </div>

                <WithdrawMethodFields method={schedMethod} values={schedDetails}
                  onChange={(key, val) => setSchedDetails((prev) => ({ ...prev, [key]: val }))} />

                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-sky-500 text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-sky-400 disabled:opacity-50 text-sm transition-all">
                  {isSubmitting ? t('processing') : t('scheduleSave')}
                </button>

                {schedule && (
                  <button type="button" onClick={handleScheduleDelete}
                    className="w-full bg-rose-500/10 text-rose-400 font-bold py-3 px-4 rounded-xl border border-rose-500/20 hover:bg-rose-500/20 text-sm transition-all">
                    {t('scheduleRemoved')}
                  </button>
                )}
              </form>

              {schedule && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-slate-400">{t('scheduleEnable')}: <span className="text-emerald-400 font-bold">{schedule.enabled ? 'Yes' : 'No'}</span></p>
                  <p className="text-xs text-slate-400">{t('amount')}: <span className="text-white font-bold">${schedule.threshold}</span></p>
                </div>
              )}
            </>
          )}
        </div>

        {/* History columns */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">{t('withdrawalHistory')}</h3>
            {withdrawals.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t('noWithdrawalRequests')}</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-60 pr-1">
                {withdrawals.map((w) => {
                  const mi = methods.find((m) => m.method === w.method);
                  return (
                    <div key={w.id} className="flex justify-between items-center bg-slate-950 p-4 border border-slate-850 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-200">
                          <span className="mr-1">{METHOD_ICONS[w.method] || ''}</span>{mi?.label || w.method}
                          {w.autoApproved && <span className="ml-2 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">{t('autoApproved')}</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">{new Date(w.createdAt).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          {w.details?.email || (w.details?.address ? w.details.address.substring(0, 8) + '...' : '')}
                        </p>
                        {w.fee && safeFloat(w.fee) > 0 && <p className="text-[10px] text-slate-500 mt-1">{t('fee')}: ${safeFloat(w.fee).toFixed(2)}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-rose-400">-${safeFloat(w.amount).toFixed(2)}</p>
                        <span className={`inline-block mt-2 text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                          w.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : w.status === 'APPROVED' || w.status === 'PROCESSING' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {w.status === 'PROCESSING' ? t('statusAPPROVED') : t(('status' + w.status) as any) || w.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-4">{t('transactionHistory')}</h3>
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t('noTransactions')}</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-60 pr-1">
                {transactions.map((tx) => {
                  const isNeg = tx.type === 'WITHDRAWAL' || tx.type === 'FRAUD_REVERSAL';
                  return (
                    <div key={tx.id} className="flex justify-between items-center bg-slate-950 p-4 border border-slate-850 rounded-xl">
                      <div className="flex items-center gap-3">
                        {isNeg ? <ArrowUpCircle className="w-5 h-5 text-rose-400" /> : <ArrowDownCircle className="w-5 h-5 text-emerald-400" />}
                        <div>
                          <p className="text-xs font-bold text-slate-200">{tx.notes || tx.type}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-extrabold ${isNeg ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isNeg ? '-' : '+'}${safeFloat(tx.amount).toFixed(2)}
                        </p>
                        <span className={`inline-block mt-1 text-[8px] font-bold uppercase ${tx.status === 'COMPLETED' ? 'text-emerald-400' : tx.status === 'PENDING' ? 'text-amber-400' : 'text-rose-400'}`}>
                          {tx.status}
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
