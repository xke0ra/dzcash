'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Bell, BellOff } from 'lucide-react';

export default function PushNotifications() {
  const { token } = useAuth();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  const subscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BDOU99h-KpESodIuVg3-GN4GdRSBXhSwhyzmB6Wsb4WEXxNTDaGj5iQ2rPq_kjGZyE4fSfKDAMJiqr5rQeWx1to') as unknown as BufferSource,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch {}
  };

  const unsubscribe = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubscribed(false);
    } catch {}
  };

  if (!supported || !token) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
    >
      {subscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      {subscribed ? 'On' : 'Off'}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
