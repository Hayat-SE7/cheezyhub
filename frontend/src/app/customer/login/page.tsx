'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

// Floating food emojis for background decoration
const FOOD_EMOJIS = ['🧀','🍔','🍕','🍟','🌮','🥪','🍗','🥤','🍦','🧁','🫕','🥙'];

export default function CustomerLoginPage() {
  const router = useRouter();
  const login  = useAuthStore((s) => s.login);

  const [identifier, setIdentifier] = useState('');
  const [pin,        setPin]        = useState('');
  const [name,       setName]       = useState('');
  const [showPin,    setShowPin]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [mode,       setMode]       = useState<'login' | 'register'>('login');

  const handleSubmit = async () => {
    if (!identifier || !pin) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authApi.login({ identifier, pin, role: 'customer' });
        login(res.data.data.token, res.data.data.user);
        toast.success('Welcome back! 🧀');
        router.replace('/customer');
      } else {
        if (!name.trim()) { toast.error('Enter your name'); setLoading(false); return; }
        const data: any = { name: name.trim(), pin };
        if (identifier.includes('@')) data.email = identifier;
        else data.mobile = identifier;
        const res = await authApi.register(data);
        login(res.data.data.token, res.data.data.user);
        toast.success('Welcome to CheezyHub! 🎉');
        router.replace('/customer');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg-customer-hero min-h-screen flex flex-col lg:flex-row relative">

      {/* ── HERO PANEL — full screen on mobile top, fixed left on desktop ── */}
      <div className="
        lg:fixed lg:inset-y-0 lg:left-0 lg:w-1/2
        flex flex-col items-center justify-center relative overflow-hidden
        pt-16 pb-36 px-8
        lg:pt-0 lg:pb-0
      ">
        {/* Floating food emojis */}
        {FOOD_EMOJIS.map((emoji, i) => (
          <div
            key={i}
            className="absolute select-none pointer-events-none"
            style={{
              top:              `${8 + (i * 7.5) % 85}%`,
              left:             `${5 + (i * 13) % 90}%`,
              animationDelay:   `${i * 0.6}s`,
              animationDuration:`${7 + (i % 4) * 2}s`,
              animation:        `floatBlob ${7 + (i % 4) * 2}s ease-in-out ${i * 0.6}s infinite`,
              opacity:          0.18 + (i % 3) * 0.07,
              fontSize:         `${2 + (i % 3) * 0.5}rem`,
            }}
          >
            {emoji}
          </div>
        ))}

        {/* Central brand */}
        <div className="relative z-10 text-center max-w-xs lg:max-w-md">
          <div className="inline-flex w-20 h-20 lg:w-24 lg:h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600
                          items-center justify-center text-4xl lg:text-5xl shadow-2xl shadow-amber-400/40 mb-6 animate-float">
            🧀
          </div>
          <h1 className="font-display font-black text-[#f5d38e] text-5xl lg:text-6xl xl:text-7xl leading-[0.95] mb-4">
            Cheeziest<br />
            <span className="text-gradient-amber">Food</span><br />
            in Town
          </h1>
          <p className="text-[#a07850] text-base lg:text-lg leading-relaxed mb-6 hidden lg:block">
            Burgers, pizzas, sides &amp; more — delivered hot and fast to your door.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['📍 Live Location','⚡ Fast Delivery','🔥 Hot Food','💵 Cash on Delivery'].map((f) => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-[#3d2a15]/80 backdrop-blur-sm
                                       border border-[#4a3520] text-[#f5d38e] text-xs font-semibold shadow-sm">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── BOTTOM SHEET (mobile) / RIGHT FORM PANEL (desktop) ── */}
      <div className="
        relative z-10 mt-auto
        bg-[#1e1208] rounded-t-[2.5rem]
        px-6 pt-6 pb-10
        shadow-[0_-24px_60px_rgba(0,0,0,0.6)]
        animate-sheet-up
        lg:fixed lg:right-0 lg:inset-y-0 lg:w-1/2
        lg:flex lg:items-center lg:justify-center
        lg:rounded-none lg:rounded-l-[2.5rem]
        lg:bg-[#160e04] lg:shadow-none
        lg:mt-0
      ">
        {/* Drag handle — mobile only */}
        <div className="lg:hidden w-10 h-1 bg-[#4a3520] rounded-full mx-auto mb-5" />

        <div className="w-full lg:max-w-sm">

          {/* Desktop heading */}
          <div className="mb-7 hidden lg:block">
            <h2 className="font-display font-bold text-[#f5d38e] text-3xl">
              {mode === 'login' ? 'Welcome back 👋' : 'Create account'}
            </h2>
            <p className="text-[#a07850] mt-1.5 text-sm">
              {mode === 'login' ? 'Sign in to your CheezyHub account' : 'Join thousands of happy customers'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1.5 bg-[#2d1a08] rounded-2xl mb-6">
            {(['login','register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-bold capitalize transition-all duration-200',
                  mode === m
                    ? 'bg-amber-600/30 text-amber-400 shadow-sm'
                    : 'text-[#a07850] hover:text-[#f5d38e]'
                )}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="animate-slide-up">
                <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">
                  Full Name
                </label>
                <input
                  className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#4a3520]
                             bg-[#2d1e0f] text-white text-[15px] transition-all
                             placeholder:text-[#7a6040] focus:border-amber-500/50 outline-none"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">
                Mobile or Email
              </label>
              <input
                className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#4a3520]
                           bg-[#2d1e0f] text-white text-[15px] transition-all
                           placeholder:text-[#7a6040] focus:border-amber-500/50 outline-none"
                placeholder="+92 3xx xxxxxxx or email@..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#a07850] mb-1.5 uppercase tracking-widest">
                PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#4a3520]
                             bg-[#2d1e0f] text-white text-[15px] transition-all pr-12
                             placeholder:text-[#7a6040] font-mono tracking-widest
                             focus:border-amber-500/50 outline-none"
                  placeholder="••••"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a07850] hover:text-[#f5d38e] transition-colors"
                  onClick={() => setShowPin(!showPin)}
                  type="button"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-press mt-6 w-full flex items-center justify-center gap-2.5 py-4
                       bg-gradient-to-r from-amber-500 to-orange-600
                       hover:from-amber-600 hover:to-orange-700
                       disabled:opacity-60 text-white rounded-2xl font-bold text-[15px]
                       shadow-lg shadow-amber-400/30 transition-all"
          >
            {loading
              ? <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait...
                </span>
              : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>
            }
          </button>

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
                <Link href={l.href} className="text-amber-600 hover:text-amber-500 font-semibold transition-colors">
                  {l.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
