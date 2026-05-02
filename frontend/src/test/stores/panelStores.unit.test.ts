import { describe, it, expect, beforeEach, vi } from 'vitest';
import Cookies from 'js-cookie';
import { useKitchenStore } from '@/store/kitchenStore';
import { useDeliveryStore } from '@/store/deliveryStore';

vi.mocked(Cookies);

describe('[kitchenStore]', () => {
  beforeEach(() => {
    useKitchenStore.setState({ user: null, token: null, isAuthenticated: false, sseConnected: false });
    vi.clearAllMocks();
  });

  it('should login and set cookies', () => {
    useKitchenStore.getState().login('k-token', { id: 'k1', username: 'chef', role: 'kitchen' }, 'k-refresh');

    const state = useKitchenStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('k-token');
    expect(state.user?.username).toBe('chef');
    expect(Cookies.set).toHaveBeenCalledWith('ch_kitchen_token', 'k-token', expect.any(Object));
    expect(Cookies.set).toHaveBeenCalledWith('ch_kitchen_refresh', 'k-refresh', expect.any(Object));
  });

  it('should logout and remove cookies', () => {
    useKitchenStore.setState({ user: { id: 'k1', username: 'chef', role: 'kitchen' }, token: 't', isAuthenticated: true });
    useKitchenStore.getState().logout();

    expect(useKitchenStore.getState().isAuthenticated).toBe(false);
    expect(useKitchenStore.getState().user).toBeNull();
    expect(Cookies.remove).toHaveBeenCalledWith('ch_kitchen_token', { path: '/' });
    expect(Cookies.remove).toHaveBeenCalledWith('ch_kitchen_refresh', { path: '/' });
  });

  it('should track SSE connection state', () => {
    expect(useKitchenStore.getState().sseConnected).toBe(false);
    useKitchenStore.getState().setSseConnected(true);
    expect(useKitchenStore.getState().sseConnected).toBe(true);
  });
});

describe('[deliveryStore]', () => {
  beforeEach(() => {
    useDeliveryStore.setState({ user: null, token: null, isAuthenticated: false, sseConnected: false });
    vi.clearAllMocks();
  });

  const driverUser = {
    id: 'd1',
    username: 'driver1',
    role: 'delivery',
    driverStatus: 'AVAILABLE' as const,
    verificationStatus: 'VERIFIED' as const,
    codPending: 0,
    activeOrderCount: 0,
  };

  it('should login and set cookies', () => {
    useDeliveryStore.getState().login('d-token', driverUser, 'd-refresh');

    const state = useDeliveryStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.driverStatus).toBe('AVAILABLE');
    expect(Cookies.set).toHaveBeenCalledWith('ch_delivery_token', 'd-token', expect.any(Object));
  });

  it('should logout and remove cookies', () => {
    useDeliveryStore.setState({ user: driverUser, token: 't', isAuthenticated: true });
    useDeliveryStore.getState().logout();

    expect(useDeliveryStore.getState().isAuthenticated).toBe(false);
    expect(Cookies.remove).toHaveBeenCalledWith('ch_delivery_token', { path: '/' });
  });

  it('should update driver status', () => {
    useDeliveryStore.setState({ user: driverUser, token: 't', isAuthenticated: true });
    useDeliveryStore.getState().updateStatus('ON_DELIVERY');

    expect(useDeliveryStore.getState().user?.driverStatus).toBe('ON_DELIVERY');
  });

  it('should handle updateStatus when no user', () => {
    useDeliveryStore.getState().updateStatus('AVAILABLE');
    expect(useDeliveryStore.getState().user).toBeNull();
  });

  it('should partially update user', () => {
    useDeliveryStore.setState({ user: driverUser, token: 't', isAuthenticated: true });
    useDeliveryStore.getState().updateUser({ codPending: 500, todayDeliveries: 3 });

    expect(useDeliveryStore.getState().user?.codPending).toBe(500);
    expect(useDeliveryStore.getState().user?.todayDeliveries).toBe(3);
    expect(useDeliveryStore.getState().user?.username).toBe('driver1'); // unchanged
  });

  it('should track SSE connection state', () => {
    useDeliveryStore.getState().setSseConnected(true);
    expect(useDeliveryStore.getState().sseConnected).toBe(true);
    useDeliveryStore.getState().setSseConnected(false);
    expect(useDeliveryStore.getState().sseConnected).toBe(false);
  });
});
