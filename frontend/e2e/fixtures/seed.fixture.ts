/**
 * Seed fixture — ensures test data exists before E2E runs.
 * Calls the backend seed endpoint or runs prisma seed.
 */

const API = process.env.API_URL || 'http://localhost:4000/api';

export async function ensureTestData(): Promise<void> {
  // Verify API is reachable
  try {
    const res = await fetch(`${API}/menu`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const json = await res.json();
    if (!json.success || !json.data?.length) {
      console.warn('[seed] Menu is empty — run `npx prisma db seed` before E2E tests');
    }
  } catch (e) {
    console.error('[seed] Backend not reachable at', API);
    throw new Error('Backend must be running for E2E tests. Start with: cd backend && npm run dev');
  }
}

export async function fetchMenu(): Promise<any[]> {
  const res = await fetch(`${API}/menu`);
  const json = await res.json();
  return json.data ?? [];
}

export async function getFirstAvailableItem(): Promise<{ id: string; name: string; basePrice: number } | null> {
  const categories = await fetchMenu();
  for (const cat of categories) {
    for (const item of cat.items ?? []) {
      if (item.isAvailable) return item;
    }
  }
  return null;
}
