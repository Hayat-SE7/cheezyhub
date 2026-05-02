import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LocationPopup from '@/components/customer/LocationPopup';

vi.mock('@/lib/api', () => ({
  addressApi: {
    saveGps: vi.fn().mockResolvedValue({ data: { data: { id: 'a1' } } }),
    create: vi.fn().mockResolvedValue({ data: { data: { id: 'a2' } } }),
  },
}));

vi.mock('@/lib/geocode', () => ({
  reverseGeocode: vi.fn().mockResolvedValue({ display: '123 Test Street, Karachi' }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('[LocationPopup]', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when not authenticated', () => {
    const { container } = render(<LocationPopup isAuthenticated={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should not render when already shown in session', () => {
    sessionStorage.setItem('ch_location_popup_shown', '1');
    const { container } = render(<LocationPopup isAuthenticated={true} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(container.querySelector('[class*="fixed"]')).toBeNull();
  });

  it('should show popup after delay when authenticated', () => {
    render(<LocationPopup isAuthenticated={true} />);
    expect(screen.queryByText(/Enable smart delivery/)).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.getByText(/Enable smart delivery/)).toBeInTheDocument();
  });

  it('should show GPS and manual entry buttons', () => {
    render(<LocationPopup isAuthenticated={true} />);
    act(() => { vi.advanceTimersByTime(1000); });

    expect(screen.getByText('Use My Current Location')).toBeInTheDocument();
    expect(screen.getByText('Enter Address Manually')).toBeInTheDocument();
  });

  it('should dismiss on skip button click', () => {
    render(<LocationPopup isAuthenticated={true} />);
    act(() => { vi.advanceTimersByTime(1000); });

    fireEvent.click(screen.getByText('Skip for now'));
    expect(sessionStorage.getItem('ch_location_popup_shown')).toBe('1');
  });

  it('should switch to manual form when clicking Enter Address Manually', () => {
    render(<LocationPopup isAuthenticated={true} />);
    act(() => { vi.advanceTimersByTime(1000); });

    fireEvent.click(screen.getByText('Enter Address Manually'));

    expect(screen.getByText('Enter your address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Street name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('City')).toBeInTheDocument();
  });

  it('should show error if manual form has insufficient fields', () => {
    render(<LocationPopup isAuthenticated={true} />);
    act(() => { vi.advanceTimersByTime(1000); });

    fireEvent.click(screen.getByText('Enter Address Manually'));
    fireEvent.click(screen.getByText('Save Address'));

    expect(screen.getByText('Please fill in at least street and city')).toBeInTheDocument();
  });

  it('should show GPS not supported error when geolocation is unavailable', () => {
    const origGeo = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });

    render(<LocationPopup isAuthenticated={true} />);
    act(() => { vi.advanceTimersByTime(1000); });

    fireEvent.click(screen.getByText('Use My Current Location'));

    expect(screen.getByText('GPS not supported on this device')).toBeInTheDocument();

    Object.defineProperty(navigator, 'geolocation', { value: origGeo, configurable: true });
  });
});
