"use client";

import Link from 'next/link';
import { useAuth } from '../providers/auth-provider';
import { Coins, CheckCircle, ShieldAlert, Award, ArrowRight, Zap, Gift, Wallet } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="relative overflow-hidden py-12 sm:py-18">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>

      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-semibold text-sky-400">
          <Zap className="w-3.5 h-3.5 fill-sky-400" />
          <span>Instant Cashouts via Crypto & PayPal</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Earn Real Money For <span className="bg-gradient-to-r from-sky-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">Completing Tasks</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-slate-400 font-medium max-w-2xl mx-auto">
          Join the highest-paying rewards platform. Earn cash by playing games, sharing opinions in surveys, and testing apps. Cash out in under 2 minutes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {user ? (
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 bg-sky-500 text-slate-900 px-8 py-4 rounded-xl text-base font-bold hover:bg-sky-400 shadow-lg shadow-sky-500/20 active:scale-95 transition-all duration-200 w-full sm:w-auto"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="group flex items-center gap-2 bg-sky-500 text-slate-900 px-8 py-4 rounded-xl text-base font-bold hover:bg-sky-400 shadow-lg shadow-sky-500/20 active:scale-95 transition-all duration-200 w-full sm:w-auto"
              >
                Start Earning Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="bg-slate-800 border border-slate-700 hover:bg-slate-750 text-white px-8 py-4 rounded-xl text-base font-bold transition-all duration-200 w-full sm:w-auto"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Grid of Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-24">
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700/80 transition-all duration-300">
          <div className="bg-sky-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-sky-400 mb-4">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">High Payouts</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            We partner with top-tier offerwalls to secure the highest conversion rates and payout points for users.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700/80 transition-all duration-300">
          <div className="bg-emerald-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-400 mb-4">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Instant Cashouts</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            No long waiting times. Request withdrawals through PayPal or Crypto, and receive funds in minutes.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700/80 transition-all duration-300">
          <div className="bg-rose-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-rose-400 mb-4">
            <Gift className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Referral System</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Invite friends to join DZCASH and earn 10% of all their offer completions forever. Passive income made easy.
          </p>
        </div>
      </div>
    </div>
  );
}
