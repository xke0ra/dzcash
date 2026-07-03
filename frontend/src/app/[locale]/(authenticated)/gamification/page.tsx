"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { Trophy, Star, Zap, Flame, Medal, Target, ChevronRight, AlertCircle, Check, Loader2 } from 'lucide-react';

interface UserXp {
  totalXp: number;
  level: number;
}

interface XpLevel {
  level: number;
  xpRequired: number;
  title: string;
  reward: any;
}

interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  iconUrl: string | null;
  category: string;
  xpReward: number;
  order: number;
  earned: boolean;
  earnedAt: string | null;
}

interface LeaderboardEntry {
  id: string;
  userId: string;
  score: number;
  period: string;
  rank: number;
  user: { id: string; email: string };
}

interface DailyStreak {
  currentStreak: number;
  longestStreak: number;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  criteria: any;
  xpReward: number;
  bonusAmount: number;
  progress: number;
  completed: boolean;
  rewardClaimed: boolean;
}

export default function GamificationPage() {
  const { token, logout } = useAuth();
  const router = useRouter();

  const [xp, setXp] = useState<UserXp | null>(null);
  const [levels, setLevels] = useState<XpLevel[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'badges' | 'leaderboard' | 'challenges'>('badges');

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [xpRes, levelsRes, badgesRes, lbRes, challengesRes, streakRes] = await Promise.all([
        fetch('/api/gamification/xp', { headers }),
        fetch('/api/gamification/levels'),
        fetch('/api/gamification/badges', { headers }),
        fetch(`/api/gamification/leaderboard/${leaderboardPeriod}`, { headers }),
        fetch('/api/gamification/challenges', { headers }),
        fetch('/api/gamification/login-streak', { method: 'POST', headers }),
      ]);

      if (xpRes.ok) setXp(await xpRes.json());
      if (levelsRes.ok) setLevels(await levelsRes.json());
      if (badgesRes.ok) setBadges(await badgesRes.json());
      if (lbRes.ok) setLeaderboard(await lbRes.json());
      if (challengesRes.ok) setChallenges(await challengesRes.json());
      if (streakRes.ok) setStreak(await streakRes.json());
    } catch (err: any) {
      setError(err.message || 'Failed to load gamification data');
    } finally {
      setIsLoading(false);
    }
  }, [token, leaderboardPeriod]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    fetchAll();
  }, [token, fetchAll, router]);

  const currentLevelDef = levels.find((l) => l.level === (xp?.level || 1));
  const nextLevelDef = levels.find((l) => l.level === ((xp?.level || 1) + 1));
  const xpInCurrentLevel = xp ? xp.totalXp - (currentLevelDef?.xpRequired || 0) : 0;
  const xpToNextLevel = nextLevelDef ? nextLevelDef.xpRequired - (currentLevelDef?.xpRequired || 0) : 1;
  const progressPct = Math.min(100, Math.round((xpInCurrentLevel / (xpToNextLevel || 1)) * 100));

  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);
  const activeChallenges = challenges.filter((c) => !c.completed);
  const completedChallenges = challenges.filter((c) => c.completed);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with XP bar */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h1 className="text-2xl font-bold text-white">Gamification</h1>
                <p className="text-sm text-slate-400">
                  Level {xp?.level} &middot; {xp?.totalXp.toLocaleString()} total XP
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-sky-400">{currentLevelDef?.title || 'Bronze I'}</p>
                <p className="text-xs text-slate-500">Next: {nextLevelDef?.title || 'Max'}</p>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>{xpInCurrentLevel.toLocaleString()} XP earned</span>
              <span>{xpToNextLevel.toLocaleString()} XP to next</span>
            </div>
          </div>
        </div>
      </div>

      {/* Streak + Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <Flame className={`w-8 h-8 ${(streak?.currentStreak || 0) >= 3 ? 'text-orange-400' : 'text-slate-600'}`} />
          <div>
            <p className="text-lg font-bold text-white">{streak?.currentStreak || 0} days</p>
            <p className="text-xs text-slate-400">Current Streak</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-400" />
          <div>
            <p className="text-lg font-bold text-white">{earnedBadges.length}/{badges.length}</p>
            <p className="text-xs text-slate-400">Badges Earned</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <Zap className="w-8 h-8 text-sky-400" />
          <div>
            <p className="text-lg font-bold text-white">{xp?.totalXp.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-400">Total XP</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        <button onClick={() => setActiveTab('badges')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors ${activeTab === 'badges' ? 'bg-sky-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}>
          <Trophy className="w-4 h-4 inline mr-1" />Badges
        </button>
        <button onClick={() => setActiveTab('leaderboard')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors ${activeTab === 'leaderboard' ? 'bg-sky-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}>
          <Medal className="w-4 h-4 inline mr-1" />Leaderboard
        </button>
        <button onClick={() => setActiveTab('challenges')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-colors ${activeTab === 'challenges' ? 'bg-sky-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}>
          <Target className="w-4 h-4 inline mr-1" />Challenges
        </button>
      </div>

      {/* Badges Tab */}
      {activeTab === 'badges' && (
        <div className="space-y-6">
          {earnedBadges.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Earned ({earnedBadges.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {earnedBadges.map((badge) => (
                  <div key={badge.id} className="bg-slate-900 border border-sky-500/30 rounded-xl p-4 text-center hover:border-sky-500/60 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-2">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-sm font-bold text-white">{badge.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{badge.description}</p>
                    {badge.earnedAt && (
                      <p className="text-[10px] text-slate-500 mt-1">{new Date(badge.earnedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {lockedBadges.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Locked ({lockedBadges.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {lockedBadges.map((badge) => (
                  <div key={badge.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center opacity-60">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2">
                      <Trophy className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">{badge.name}</p>
                    <p className="text-xs text-slate-600 mt-1">{badge.description}</p>
                    <p className="text-[10px] text-slate-600 mt-1">+{badge.xpReward} XP</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Leaderboard</h2>
            <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setLeaderboardPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${leaderboardPeriod === p ? 'bg-sky-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  {p === 'DAILY' ? 'Today' : p === 'WEEKLY' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No data yet. Start earning XP!</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.id} className="flex items-center justify-between bg-slate-950 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i < 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{entry.user.email.split('@')[0]}</p>
                      <p className="text-xs text-slate-500">{entry.score.toLocaleString()} XP</p>
                    </div>
                  </div>
                  {i < 3 && <Medal className={`w-5 h-5 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : 'text-amber-700'}`} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Challenges Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-6">
          {activeChallenges.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Active Challenges</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeChallenges.map((c) => {
                  const threshold = c.criteria?.threshold || 1;
                  const pct = Math.min(100, Math.round((c.progress / threshold) * 100));
                  return (
                    <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-white">{c.name}</h3>
                          <p className="text-xs text-slate-400 mt-1">{c.description}</p>
                        </div>
                        <div className="text-right">
                          {c.xpReward > 0 && <p className="text-xs text-sky-400 font-bold">+{c.xpReward} XP</p>}
                          {Number(c.bonusAmount) > 0 && <p className="text-xs text-emerald-400 font-bold">+${Number(c.bonusAmount).toFixed(2)}</p>}
                        </div>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{c.progress}/{threshold}</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {completedChallenges.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Completed</h2>
              <div className="space-y-2">
                {completedChallenges.map((c) => (
                  <div key={c.id} className="bg-slate-900 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        <p className="text-xs text-slate-400">{c.description}</p>
                      </div>
                    </div>
                    {!c.rewardClaimed ? (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/gamification/challenges/${c.id}/claim`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (res.ok) fetchAll();
                        }}
                        className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                      >
                        Claim
                      </button>
                    ) : (
                      <Check className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {challenges.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">No challenges available right now. Check back later!</div>
          )}
        </div>
      )}
    </div>
  );
}
