'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show) return null;

  const handleInstall = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      setDeferredPrompt(null);
      setShow(false);
    });
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-sky-400 font-bold text-sm">DZ</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Install DZCASH</p>
          <p className="text-[11px] text-slate-400 truncate">Add to your home screen for the best experience</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold px-4 py-2 rounded-xl text-xs shrink-0"
        >
          Install
        </button>
        <button
          onClick={() => setShow(false)}
          className="p-1 text-slate-500 hover:text-white shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
