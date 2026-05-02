'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight, Phone, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const FOOD_EMOJIS = ['🧀','🍔','🍕','🍟','🌮','🥪','🍗','🥤','🍦','🧁','🫕','🥙'];

type Step = 'phone' | 'otp' | 'details';

export default function CustomerLoginPage() {
  const router = useRouter();
  const login  = useAuthStore((s) => s.login);

  // ── Login state ──────────────────────────────────────
  const [mode,       setMode]       = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [pin,        setPin]        = useState('');
  const [showPin,    setShowPin]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  // ── Register OTP state ───────────────────────────────
  const [step,              setStep]              = useState<Step>('phone');
  const [mobile,            setMobile]            = useState('');
  const [otpCode,           setOtpCode]           = useState('');
  const [name,              setName]              = useState('');
  const [regPin,            setRegPin]            = useState('');
  const [showRegPin,        setShowRegPin]        = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [countdown,         setCountdown]         = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Login ────────────────────────────────────────────
  const handleLogin = async () => {
    if (!identifier || !pin) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await authApi.login({ identifier, pin, role: 'customer' });
      login(res.data.data.token, res.data.data.user, res.data.data.refreshToken);
      toast.success('Welcome back! 🧀');
      router.replace('/customer');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Send OTP ─────────────────────────────────
  const handleSendOtp = async () => {
    if (!mobile.trim()) { toast.error('Enter your mobile number'); return; }
    setLoading(true);
    try {
      await authApi.sendOtp(mobile.trim());
      setStep('otp');
      setCountdown(60);
      toast.success('OTP sent!');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const res  = await authApi.verifyOtp(mobile.trim(), otpCode);
      const data = res.data.data;
      setVerificationToken(data.verificationToken);
      setStep('details');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Complete registration ────────────────────
  const handleCompleteReg = async () => {
    if (!name.trim())      { toast.error('Enter your name'); return; }
    if (regPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    setLoading(true);
    try {
      const res = await authApi.completeRegistration({ verificationToken, name: name.trim(), pin: regPin });
      login(res.data.data.token, res.data.data.user, res.data.data.refreshToken);
      toast.success('Welcome to CheezyHub! 🎉');
      router.replace('/customer');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg-customer-hero min-h-screen flex flex-col lg:flex-row relative">

      {/* ── HERO PANEL ── */}
      <div className="
        lg:fixed lg:inset-y-0 lg:left-0 lg:w-1/2
        flex flex-col items-center justify-center relative overflow-hidden
        pt-16 pb-36 px-8 lg:pt-0 lg:pb-0
      ">
        {FOOD_EMOJIS.map((emoji, i) => (
          <div key={i} className="absolute select-none pointer-events-none" style={{
            top: `${8 + (i * 7.5) % 85}%`, left: `${5 + (i * 13) % 90}%`,
            animationDelay: `${i * 0.6}s`, animationDuration: `${7 + (i % 4) * 2}s`,
            animation: `floatBlob ${7 + (i % 4) * 2}s ease-in-out ${i * 0.6}s infinite`,
            opacity: 0.18 + (i % 3) * 0.07, fontSize: `${2 + (i % 3) * 0.5}rem`,
          }}>{emoji}</div>
        ))}
        <div className="relative z-10 text-center max-w-xs lg:max-w-md">
          <div className="inline-flex w-20 h-20 lg:w-24 lg:h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600
                          items-center justify-center text-4xl lg:text-5xl shadow-2xl shadow-amber-400/40 mb-6 animate-float">
            🧀
          </div>
          <h1 className="font-display font-black text-[#f5d38e] text-5xl lg:text-6xl xl:text-7xl leading-[0.95] mb-4">
            Cheeziest<br /><span className="text-gradient-amber">Food</span><br />in Town
          </h1>
          <p className="text-[#a07850] text-base lg:text-lg leading-relaxed mb-6 hidden lg:block">
            Burgers, pizzas, sides &amp; more — delivered hot and fast to your door.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['📍 Live Location','⚡ Fast Delivery','🔥 Hot Food','💵 Cash on Delivery'].map((f) => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-[#3d2a15]/80 backdrop-blur-sm
                                       border border-[#4a3520] text-[#f5d38e] text-xs font-semibold shadow-sm">{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── FORM PANEL ── */}
      <div className="
        relative z-10 mt-auto bg-[#1e1208] rounded-t-[2.5rem]
        px-6 pt-6 pb-10 shadow-[0_-24px_60px_rgba(0,0,0,0.6)] animate-sheet-up
        lg:fixed lg:right-0 lg:inset-y-0 lg:w-1/2
        lg:flex lg:items-center lg:justify-center
        lg:rounded-none lg:rounded-l-[2.5rem] lg:bg-[#160e04] lg:shadow-none lg:mt-0
      ">
        <div className="lg:hidden w-10 h-1 bg-[#4a3520] rounded-full mx-auto mb-5" />
        <div className="w-full lg:max-w-sm">

          <div className="mb-7 hidden lg:block">
            <h2 className="font-display font-bold text-[#f5d38e] text-3xl">
              {mode === 'login' ? 'Welcome back 👋' :
               step === 'phone'   ? 'Create account' :
               step === 'otp'     ? 'Verify number'  : 'Almost done!'}
            </h2>
            <p className="text-[#a07850] mt-1.5 text-sm">
              {mode === 'login' ? 'Sign in to your CheezyHub account' : 'Join thousands of happy customers'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1.5 bg-[#2d1a08] rounded-2xl mb-6">
            {(['login','register'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setStep('phone'); }}
                className={clsx('flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all duration-200',
                  mode === m ? 'bg-amber-600/30 text-amber-400 shadow-sm' : 'text-[#a07850] hover:text-[#f5d38e]')}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">Mobile or Email</label>
                <input className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#4a3520]
                                  bg-[#2d1e0f] text-white text-[15px] placeholder:text-[#7a6040]
                                  focus:border-amber-500/50 outline-none transition-all"
                  placeholder="+92 3xx xxxxxxx or email@..." value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">PIN</label>
                <div className="relative">
                  <input type={showPin ? 'text' : 'password'}
                    className="input-glow w-full px-4 py-3.5 pr-12 rounded-xl border border-[#4a3520]
                               bg-[#2d1e0f] text-white text-[15px] font-mono tracking-widest
                               placeholder:text-[#7a6040] focus:border-amber-500/50 outline-none transition-all"
                    placeholder="••••" maxLength={8} value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                  <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a07850] hover:text-[#f5d38e] transition-colors"
                    onClick={() => setShowPin(!showPin)} type="button">
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button onClick={handleLogin} disabled={loading}
                className="btn-press mt-2 w-full flex items-center justify-center gap-2.5 py-4
                           bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700
                           disabled:opacity-60 text-white rounded-2xl font-bold text-[15px]
                           shadow-lg shadow-amber-400/30 transition-all">
                {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Please wait...</span>
                         : <>Sign In <ArrowRight size={16} /></>}
              </button>
            </div>
          )}

          {/* ── REGISTER STEP 1: Phone ── */}
          {mode === 'register' && step === 'phone' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">Mobile Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a07850]" />
                  <input className="input-glow w-full pl-10 pr-4 py-3.5 rounded-xl border border-[#4a3520]
                                    bg-[#2d1e0f] text-white text-[15px] placeholder:text-[#7a6040]
                                    focus:border-amber-500/50 outline-none transition-all"
                    placeholder="03xx xxxxxxx" value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()} />
                </div>
              </div>
              <button onClick={handleSendOtp} disabled={loading}
                className="btn-press w-full flex items-center justify-center gap-2.5 py-4
                           bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700
                           disabled:opacity-60 text-white rounded-2xl font-bold text-[15px]
                           shadow-lg shadow-amber-400/30 transition-all">
                {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</span>
                         : <>Send OTP <ArrowRight size={16} /></>}
              </button>
            </div>
          )}

          {/* ── REGISTER STEP 2: OTP ── */}
          {mode === 'register' && step === 'otp' && (
            <div className="flex flex-col gap-4">
              <p className="text-[#a07850] text-sm text-center">
                Code sent to <span className="text-amber-400 font-semibold">{mobile}</span>
              </p>
              <div>
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">6-Digit Code</label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a07850]" />
                  <input className="input-glow w-full pl-10 pr-4 py-3.5 rounded-xl border border-[#4a3520]
                                    bg-[#2d1e0f] text-white text-[15px] font-mono tracking-[0.3em]
                                    placeholder:text-[#7a6040] focus:border-amber-500/50 outline-none transition-all"
                    placeholder="______" maxLength={6} value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()} />
                </div>
              </div>
              <button onClick={handleVerifyOtp} disabled={loading}
                className="btn-press w-full flex items-center justify-center gap-2.5 py-4
                           bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700
                           disabled:opacity-60 text-white rounded-2xl font-bold text-[15px]
                           shadow-lg shadow-amber-400/30 transition-all">
                {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</span>
                         : <>Verify Code <ArrowRight size={16} /></>}
              </button>
              <button onClick={() => { setStep('phone'); setOtpCode(''); }}
                disabled={countdown > 0}
                className="text-sm text-center text-[#a07850] hover:text-amber-400 transition-colors disabled:opacity-40">
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>
          )}

          {/* ── REGISTER STEP 3: Details ── */}
          {mode === 'register' && step === 'details' && (
            <div className="flex flex-col gap-4">
              <p className="text-[#a07850] text-sm text-center">Phone verified ✅ — complete your profile</p>
              <div>
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">Full Name</label>
                <input className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#4a3520]
                                  bg-[#2d1e0f] text-white text-[15px] placeholder:text-[#7a6040]
                                  focus:border-amber-500/50 outline-none transition-all"
                  placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">Set a PIN</label>
                <div className="relative">
                  <input type={showRegPin ? 'text' : 'password'}
                    className="input-glow w-full px-4 py-3.5 pr-12 rounded-xl border border-[#4a3520]
                               bg-[#2d1e0f] text-white text-[15px] font-mono tracking-widest
                               placeholder:text-[#7a6040] focus:border-amber-500/50 outline-none transition-all"
                    placeholder="4–8 digits" maxLength={8} value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleCompleteReg()} />
                  <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a07850] hover:text-[#f5d38e] transition-colors"
                    onClick={() => setShowRegPin(!showRegPin)} type="button">
                    {showRegPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button onClick={handleCompleteReg} disabled={loading}
                className="btn-press w-full flex items-center justify-center gap-2.5 py-4
                           bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700
                           disabled:opacity-60 text-white rounded-2xl font-bold text-[15px]
                           shadow-lg shadow-amber-400/30 transition-all">
                {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</span>
                         : <>Create Account <ArrowRight size={16} /></>}
              </button>
            </div>
          )}

          {/* Staff links */}
          <div className="mt-6 flex items-center justify-center gap-1 text-xs text-[#a39083]">
            <span>Staff?</span>
            {[
              { href: '/kitchen/login',  label: 'Kitchen' },
              { href: '/delivery/login', label: 'Delivery' },
              { href: '/admin/login',    label: 'Admin' },
            ].map((l, i) => (
              <span key={l.href} className="flex items-center gap-1">
                {i > 0 && <span className="text-[#d9cfc0]">·</span>}
                <Link href={l.href} className="text-amber-600 hover:text-amber-500 font-semibold transition-colors">{l.label}</Link>
              </span>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
