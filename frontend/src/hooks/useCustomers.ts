// ─────────────────────────────────────────────────────
//  useCustomers  — Phase 11
//  Paginated customer list with search/filter/sort
// ─────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';

export interface CustomerRow {
  id:           string;
  name:         string;
  mobile?:      string;
  email?:       string;
  isBlocked:    boolean;
  adminNote?:   string;
  tags:         string[];
  createdAt:    string;
  totalOrders:  number;
  totalSpent:   number;
  addressCount: number;
  lastOrderAt?: string;
  isAtRisk:     boolean;
}

interface Params {
  page?:    number;
  limit?:   number;
  search?:  string;
  status?:  'all' | 'active' | 'blocked';
  sort?:    'recent' | 'spent' | 'orders';
  atRisk?:  boolean;
}

export function useCustomers(params: Params = {}) {
  const [data,    setData]    = useState<CustomerRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getCustomers({
        page:   params.page   ?? 1,
        limit:  params.limit  ?? 25,
        search: params.search || undefined,
        status: params.status !== 'all' ? params.status : undefined,
        sort:   params.sort || undefined,
        atRisk: params.atRisk ? 'true' : undefined,
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [params.page, params.limit, params.search, params.status, params.sort, params.atRisk]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, total, loading, error, refetch: fetch };
}
