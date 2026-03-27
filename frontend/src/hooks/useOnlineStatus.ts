'use client';

import { useState, useEffect, useCallback } from 'react';

export type OnlineStatusValue = 'online' | 'offline' | 'slow' | 'reconnecting';

export interface OnlineStatus {
  isOnline:     boolean;
  isOffline:    boolean;
  status:       OnlineStatusValue;
  rtt:          number;
  lastOnlineAt: Date | null;
  lastSyncAt:   Date | null;
  setLastSyncAt:(done: number, total: number) => void;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline,     setIsOnline]    = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(isOnline ? new Date() : null);
  const [rtt,          setRtt]         = useState<number>(0);
  const [lastSyncAt,   setLastSyncAt_] = useState<Date | null>(null);

  useEffect(() => {
    const online  = () => { setIsOnline(true); setLastOnlineAt(new Date()); };
    const offline = () => { setIsOnline(false); };

    window.addEventListener('online',  online);
    window.addEventListener('offline', offline);

    const conn = (navigator as any).connection;
    let changeHandler: () => void;
    if (conn) {
      setRtt(conn.rtt ?? 0);
      changeHandler = () => setRtt(conn.rtt ?? 0);
      conn.addEventListener('change', changeHandler);
    }

    return () => {
      window.removeEventListener('online',  online);
      window.removeEventListener('offline', offline);
      if (conn && changeHandler) conn.removeEventListener('change', changeHandler);
    };
  }, []);

  // Signature matches drainQueue's onProgress callback: (done, total) => void
  // We just set lastSyncAt to now whenever called (regardless of done/total)
  const setLastSyncAt = useCallback((_done: number, _total: number) => {
    setLastSyncAt_(new Date());
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    status: !isOnline ? 'offline' : (rtt > 500 ? 'slow' : 'online'),
    rtt,
    lastOnlineAt,
    lastSyncAt,
    setLastSyncAt
  };
}
