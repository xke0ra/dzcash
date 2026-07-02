"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../providers/auth-provider';
import { Bell, BellOff, Check, CheckCheck, X, Trash2, Loader } from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?page=${pageNum}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (append) {
        setNotifications(prev => [...prev, ...data.items]);
      } else {
        setNotifications(data.items);
      }
      setUnreadCount(data.unreadCount);
      setHasMore(data.total > pageNum * 10);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {}
  }, [token]);

  // Poll for unread count
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchNotifications(1);
    }
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  const typeIcons: Record<string, string> = {
    OFFER_COMPLETED: '🎉',
    WITHDRAWAL_STATUS: '💰',
    FRAUD_ALERT: '⚠️',
    REFERRAL_BONUS: '👥',
    ACCOUNT_STATUS: '🔔',
    SYSTEM: '💡',
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors"
      >
        {unreadCount > 0 ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-medium"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && !loading && (
              <div className="p-8 text-center text-slate-500 text-sm">
                <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No notifications
              </div>
            )}

            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                  !n.read ? 'bg-sky-500/5' : ''
                }`}
              >
                <span className="text-lg shrink-0 mt-0.5">{typeIcons[n.type] || '💡'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${n.read ? 'text-slate-300' : 'text-white font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="p-1 text-slate-500 hover:text-sky-400 transition-colors"
                      title="Mark read"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {loading && (
              <div className="p-4 text-center">
                <Loader className="w-5 h-5 animate-spin mx-auto text-slate-500" />
              </div>
            )}

            {hasMore && !loading && (
              <button
                onClick={loadMore}
                className="w-full p-3 text-[11px] text-sky-400 hover:bg-slate-800/50 font-medium transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
