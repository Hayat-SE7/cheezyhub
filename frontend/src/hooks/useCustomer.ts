// ─────────────────────────────────────────────────────
//  useCustomer  — Phase 11  (single customer profile)
// ─────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';

export interface TimelineEntry {
  type:  string;
  label: string;
  date:  string;
}

export interface CustomerDetail {
  id:          string;
  name:        string;
  mobile?:     string;
  email?:      string;
  isBlocked:   boolean;
  adminNote?:  string;
  tags:        string[];
  createdAt:   string;
  totalOrders: number;
  totalSpent:  number;
  addresses:   any[];
  orders:      any[];
  timeline:    TimelineEntry[];
}

export function useCustomer(id: string) {
  const [data,    setData]    = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getCustomer(id);
      setData(res.data.data);
    } catch {
      setError('Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const update = async (payload: { adminNote?: string; isBlocked?: boolean; tags?: string[] }) => {
    await adminApi.updateCustomer(id, payload);
    await fetch();
  };

  return { data, loading, error, refetch: fetch, update };
}
