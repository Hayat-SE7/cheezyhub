// ─────────────────────────────────────────────────────
//  useStaff  — Phase 11
// ─────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';

export interface StaffMember {
  id:          string;
  username:    string;
  fullName?:   string;
  phone?:      string;
  role:        string;
  isActive:    boolean;
  lastLoginAt?: string;
  createdAt:   string;
}

export function useStaff() {
  const [data,    setData]    = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getStaff();
      setData(res.data.data);
    } catch {
      setError('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
