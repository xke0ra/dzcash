"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth-provider';
import { X, Bell } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  body: string;
  type: string;
}

export default function NotificationToast() {
  const { token } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        const toast: Toast = {
          id: data.id,
          title: data.title,
          body: data.body,
          type: data.type,
        };
        setToasts((prev) => [...prev, toast]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== data.id));
        }, 5000);
      } catch {}
    });

    eventSource.onerror = () => {};

    return () => {
      eventSource.close();
    };
  }, [token]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  const typeIcons: Record<string, string> = {
    OFFER_COMPLETED: '🎉',
    WITHDRAWAL_STATUS: '💰',
    FRAUD_ALERT: '⚠️',
    REFERRAL_BONUS: '👥',
    ACCOUNT_STATUS: '🔔',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-slide-up flex items-start gap-3"
          style={{
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <span className="text-xl shrink-0">{typeIcons[toast.type] || '💡'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">{toast.title}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{toast.body}</p>
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
