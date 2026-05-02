import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomerLoginPage from '@/app/customer/login/page';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({
      data: { data: { token: 'tok', refreshToken: 'ref', user: { id: 'u1', name: 'Test', role: 'customer' } } },
    }),
    sendOtp: vi.fn().mockResolvedValue({ data: { data: { message: 'OTP sent' } } }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { data: { verificationToken: 'vt-123' } } }),
    completeRegistration: vi.fn().mockResolvedValue({
      data: { data: { token: 'tok', refreshToken: 'ref', user: { id: 'u2', name: 'New', role: 'customer' } } },
    }),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe('[CustomerLoginPage]', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    vi.clearAllMocks();
  });

  describe('Login mode', () => {
    it('should render login form with identifier and PIN inputs', () => {
      render(<CustomerLoginPage />);
      expect(screen.getByPlaceholderText(/\+92 3xx|email@/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••')).toBeInTheDocument();
    });

    it('should have tab switcher for login and register', () => {
      render(<CustomerLoginPage />);
      // Use getAllByText since tab and submit button both say "Sign In"
      const signInElements = screen.getAllByText('Sign In');
      expect(signInElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Register')).toBeInTheDocument();
    });

    it('should call login API on Enter key in PIN field', async () => {
      const { authApi } = await import('@/lib/api');
      render(<CustomerLoginPage />);

      fireEvent.change(screen.getByPlaceholderText(/\+92 3xx|email@/), { target: { value: '03001234567' } });
      fireEvent.change(screen.getByPlaceholderText('••••'), { target: { value: '1234' } });
      fireEvent.keyDown(screen.getByPlaceholderText('••••'), { key: 'Enter' });

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          identifier: '03001234567',
          pin: '1234',
          role: 'customer',
        });
      });
    });

    it('should toggle PIN visibility', () => {
      render(<CustomerLoginPage />);
      const pinInput = screen.getByPlaceholderText('••••');
      expect(pinInput).toHaveAttribute('type', 'password');

      // Find toggle button by type="button"
      const buttons = screen.getAllByRole('button').filter(b => b.getAttribute('type') === 'button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        expect(pinInput).toHaveAttribute('type', 'text');
      }
    });

    it('should only allow numeric PIN input', () => {
      render(<CustomerLoginPage />);
      const pinInput = screen.getByPlaceholderText('••••') as HTMLInputElement;
      fireEvent.change(pinInput, { target: { value: 'abc123' } });
      expect(pinInput.value).toBe('123');
    });

    it('should show error toast when fields are empty on submit', async () => {
      const toast = (await import('react-hot-toast')).default;
      render(<CustomerLoginPage />);

      // Click the actual submit button (not the tab)
      const signInButtons = screen.getAllByText('Sign In');
      // The submit button is the last one (inside the form area)
      fireEvent.click(signInButtons[signInButtons.length - 1]);

      expect(toast.error).toHaveBeenCalledWith('Please fill in all fields');
    });
  });

  describe('Register mode', () => {
    it('should switch to register mode on tab click', () => {
      render(<CustomerLoginPage />);
      fireEvent.click(screen.getByText('Register'));
      expect(screen.getByPlaceholderText('03xx xxxxxxx')).toBeInTheDocument();
    });

    it('should show Send OTP button', () => {
      render(<CustomerLoginPage />);
      fireEvent.click(screen.getByText('Register'));
      expect(screen.getByText(/Send OTP/)).toBeInTheDocument();
    });

    it('should call sendOtp and move to OTP step', async () => {
      const { authApi } = await import('@/lib/api');
      render(<CustomerLoginPage />);
      fireEvent.click(screen.getByText('Register'));

      fireEvent.change(screen.getByPlaceholderText('03xx xxxxxxx'), { target: { value: '03001234567' } });
      fireEvent.click(screen.getByText(/Send OTP/));

      await waitFor(() => {
        expect(authApi.sendOtp).toHaveBeenCalledWith('03001234567');
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('______')).toBeInTheDocument();
      });
    });

    it('should show error when mobile is empty', async () => {
      const toast = (await import('react-hot-toast')).default;
      render(<CustomerLoginPage />);
      fireEvent.click(screen.getByText('Register'));
      fireEvent.click(screen.getByText(/Send OTP/));

      expect(toast.error).toHaveBeenCalledWith('Enter your mobile number');
    });
  });

  describe('Staff links', () => {
    it('should show staff login links', () => {
      render(<CustomerLoginPage />);
      expect(screen.getByText('Kitchen')).toBeInTheDocument();
      expect(screen.getByText('Delivery')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });
});
