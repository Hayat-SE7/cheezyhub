'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight, Phone, ShieldCheck, User } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────

type Mode  = 'login' | 'register';
type Step  = 'phone' | 'otp' | 'profile'; // register steps

// ─── Shared input style ───────────────────────────────

const INPUT = 'w-full px-4 py-3.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-[15px] transition-all placeholder:text-[#c4b8ac] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20';

export default function CustomerLoginPage() {
  const router = useRouter();
  const loginStore = useAuthStore((s) => s.login);

  // ── Shared state ───────────────────────────────────
  const [mode,    setMode]    = useState<Mode>('login');
  const [loading, setLoading] = useState(false);

  // ── Login state ────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [pin,        setPin]        = useState('');
  const [showPin,    setShowPin]    = useState(false);

  // ── Register state (multi-step) ────────────────────
  const [step,              setStep]              = useState<Step>('phone');
  const [mobile,            setMobile]            = useState('');
  const [otp,               setOtp]               = useState(['', '', '', '', '', '']);
  const [verificationToken, setVerificationToken] = useState('');
  const [name,              setName]              = useState('');
  const [regPin,            setRegPin]            = useState('');
  const [showRegPin,        setShowRegPin]        = useState(false);
  const [countdown,         setCountdown]         = useState(0); // resend cooldown

  // OTP input refs for auto-advance
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Reset register state when switching modes
  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('phone');
    setMobile('');
    setOtp(['', '', '', '', '', '']);
    setVerificationToken('');
    setName('');
    setRegPin('');
    setCountdown(0);
  };

  // ── Login handler ──────────────────────────────────

  const handleLogin = async () => {
    if (!identifier.trim() || !pin) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login({ identifier: identifier.trim(), pin, role: 'customer' });
      loginStore(res.data.data.token, res.data.data.user);
      toast.success('Welcome back! 🧀');
      router.replace('/customer');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // ── Register Step 1: Send OTP ──────────────────────

  const handleSendOtp = async () => {
    const cleaned = mobile.trim().replace(/\s+/g, '');
    if (!cleaned) {
      toast.error('Enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.sendOtp(cleaned);
      toast.success('OTP sent! Check your messages.');

      // Dev mode: auto-fill OTP from response
      if (res.data._devOtp) {
        const digits = res.data._devOtp.toString().split('');
        setOtp(digits);
        toast(`Dev mode: OTP = ${res.data._devOtp}`, { icon: '🔧' });
      }

      setMobile(cleaned);
      setStep('otp');
      setCountdown(60);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const res = await authApi.sendOtp(mobile);
      toast.success('New OTP sent!');
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);

      if (res.data._devOtp) {
        const digits = res.data._devOtp.toString().split('');
        setOtp(digits);
        toast(`Dev: OTP = ${res.data._devOtp}`, { icon: '🔧' });
      }

      otpRefs[0].current?.focus();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (index: number, value: string) => {
    // Allow pasting full 6-digit code
    if (value.length === 6 && /^\d{6}$/.test(value)) {
      setOtp(value.split(''));
      otpRefs[5].current?.focus();
      return;
    }
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter' && otp.every(Boolean)) {
      handleVerifyOtp();
    }
  };

  // ── Register Step 2: Verify OTP ───────────────────

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      toast.error('Enter all 6 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(mobile, code);
      setVerificationToken(res.data.data.verificationToken);
      toast.success('Phone verified! ✅');
      setStep('profile');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Verification failed');
      // Clear OTP on wrong code
      setOtp(['', '', '', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Register Step 3: Set name + PIN ───────────────

  const handleCompleteRegistration = async () => {
    if (!name.trim()) {
      toast.error('Enter your name');
      return;
    }
    if (regPin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.completeRegistration({
        verificationToken,
        name: name.trim(),
        pin:  regPin,
      });
      loginStore(res.data.data.token, res.data.data.user);
      toast.success('Welcome to CheezyHub! 🎉');
      router.replace('/customer');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Registration failed');
      // If verification token expired, send back to OTP step
      if (err.response?.data?.error?.includes('expired')) {
        setStep('otp');
        setOtp(['', '', '', '', '', '']);
        toast.error('Session expired. Please verify your phone again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-300/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-48 h-48 bg-orange-300/10 rounded-full blur-2xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl shadow-amber-400/40 mb-5 text-4xl">
            🧀
          </div>
          <h1 className="font-display font-bold text-4xl text-[#1c1714] tracking-tight">
            CheezyHub
          </h1>
          <p className="text-[#a39083] mt-2 text-[15px]">
            {mode === 'login' ? 'Good to see you again!' : 'Join the cheese family 🎉'}
          </p>
        </div>

        <div className="w-full max-w-sm animate-slide-up" style={{ animationDelay: '80ms' }}>

          {/* Mode tabs */}
          <div className="flex p-1 bg-[#ede8e0] rounded-2xl mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-display font-bold capitalize transition-all duration-200',
                  mode === m
                    ? 'bg-white text-[#1c1714] shadow-md shadow-black/8'
                    : 'text-[#a39083] hover:text-[#5c5147]'
                )}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-[#ece6dc] shadow-xl shadow-amber-900/5 p-7">

            {/* ── LOGIN FORM ─────────────────────── */}
            {mode === 'login' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#a39083] mb-1.5 uppercase tracking-wider">
                    Mobile or Email
                  </label>
                  <input
                    className={INPUT}
                    placeholder="+92 3xx xxxx xxx or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#a39083] mb-1.5 uppercase tracking-wider">
                    PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      className={clsx(INPUT, 'pr-12 font-mono tracking-widest')}
                      placeholder="••••"
                      maxLength={8}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c4b8ac] hover:text-[#5c5147]"
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="btn-press mt-2 w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-60 text-white rounded-2xl font-display font-bold text-[15px] shadow-lg shadow-amber-400/30 transition-all"
                >
                  {loading ? 'Signing in...' : <><span>Sign In</span><ArrowRight size={16} /></>}
                </button>
              </div>
            )}

            {/* ── REGISTER STEP 1: PHONE ─────────── */}
            {mode === 'register' && step === 'phone' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Phone size={16} />
                  <span className="text-sm font-semibold">Enter your phone number</span>
                </div>
                <p className="text-xs text-[#a39083] -mt-2">
                  We'll send a 6-digit code to verify your number.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#a39083] mb-1.5 uppercase tracking-wider">
                    Mobile Number
                  </label>
                  <input
                    className={INPUT}
                    placeholder="+92 3xx xxxx xxx"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    type="tel"
                    inputMode="tel"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  />
                </div>
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="btn-press mt-2 w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-60 text-white rounded-2xl font-display font-bold text-[15px] shadow-lg shadow-amber-400/30 transition-all"
                >
                  {loading ? 'Sending...' : <><span>Send OTP</span><ArrowRight size={16} /></>}
                </button>
              </div>
            )}

            {/* ── REGISTER STEP 2: OTP ───────────── */}
            {mode === 'register' && step === 'otp' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <ShieldCheck size={16} />
                  <span className="text-sm font-semibold">Verify your number</span>
                </div>
                <p className="text-xs text-[#a39083] -mt-2">
                  Enter the 6-digit code sent to <span className="font-semibold text-[#5c5147]">{mobile}</span>
                </p>

                {/* OTP boxes */}
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onFocus={(e) => e.target.select()}
                      className={clsx(
                        'w-11 h-12 text-center text-xl font-mono font-bold rounded-xl border-2 transition-all focus:outline-none',
                        digit
                          ? 'border-amber-500 bg-amber-50 text-[#1c1714]'
                          : 'border-[#ece6dc] bg-[#faf9f6] text-[#1c1714]',
                        'focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20'
                      )}
                    />
                  ))}
                </div>

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.some((d) => !d)}
                  className="btn-press w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white rounded-2xl font-display font-bold text-[15px] shadow-lg shadow-amber-400/30 transition-all"
                >
                  {loading ? 'Verifying...' : <><span>Verify Code</span><ArrowRight size={16} /></>}
                </button>

                {/* Resend + back */}
                <div className="flex items-center justify-between text-xs text-[#a39083]">
                  <button
                    onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); }}
                    className="hover:text-[#5c5147] transition-colors"
                  >
                    ← Change number
                  </button>
                  <button
                    onClick={handleResendOtp}
                    disabled={countdown > 0 || loading}
                    className="text-amber-600 hover:text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* ── REGISTER STEP 3: PROFILE ───────── */}
            {mode === 'register' && step === 'profile' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <User size={16} />
                  <span className="text-sm font-semibold">Set up your account</span>
                </div>
                <p className="text-xs text-[#a39083] -mt-2">
                  One last step — enter your name and create a PIN.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-[#a39083] mb-1.5 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    className={INPUT}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#a39083] mb-1.5 uppercase tracking-wider">
                    Create PIN (4–8 digits)
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      className={clsx(INPUT, 'pr-12 font-mono tracking-widest')}
                      placeholder="••••"
                      maxLength={8}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleCompleteRegistration()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c4b8ac] hover:text-[#5c5147]"
                    >
                      {showRegPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleCompleteRegistration}
                  disabled={loading}
                  className="btn-press mt-2 w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-60 text-white rounded-2xl font-display font-bold text-[15px] shadow-lg shadow-amber-400/30 transition-all"
                >
                  {loading ? 'Creating account...' : <><span>Create Account</span><ArrowRight size={16} /></>}
                </button>
              </div>
            )}
          </div>

          {/* Staff links */}
          <p className="text-center text-[#a39083] text-xs mt-5">
            Staff?{' '}
            <Link href="/kitchen/login" className="text-amber-600 hover:text-amber-700 font-semibold">Kitchen</Link>
            {' · '}
            <Link href="/delivery/login" className="text-amber-600 hover:text-amber-700 font-semibold">Delivery</Link>
            {' · '}
            <Link href="/admin/login" className="text-amber-600 hover:text-amber-700 font-semibold">Admin</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
