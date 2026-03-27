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
    <div className="login-bg-customer min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT HERO PANEL (desktop only) ──────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col items-center justify-center p-16 overflow-hidden">
        {/* Floating emoji orbs */}
        {FOOD_EMOJIS.map((emoji, i) => (
          <div
            key={i}
            className="absolute text-4xl select-none pointer-events-none"
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

        {/* Central brand display */}
        <div className="relative z-10 text-center max-w-lg">
          <div className="inline-flex w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center text-5xl shadow-2xl shadow-amber-400/40 mb-8 animate-float">
            🧀
          </div>
          <h1 className="font-display font-black text-[#1c1714] text-6xl xl:text-7xl leading-[0.95] mb-6">
            Cheeziest<br />
            <span className="text-gradient-amber">Food</span><br />
            in Town
          </h1>
          <p className="text-[#7a6d63] text-xl leading-relaxed mb-8">
            Burgers, pizzas, sides &amp; more — delivered hot and fast to your door.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2.5 justify-center">
            {['📍 Live Location','⚡ Fast Delivery','🔥 Hot Food','💵 Cash on Delivery'].map((f) => (
              <span key={f} className="px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/70 text-[#5c5147] text-sm font-semibold shadow-sm">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20 min-h-screen lg:min-h-0">

        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8 animate-slide-up">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 items-center justify-center text-3xl shadow-xl shadow-amber-400/30 mb-3">
            🧀
          </div>
          <h1 className="font-display font-black text-[#1c1714] text-3xl">CheezyHub</h1>
        </div>

        <div className="w-full max-w-sm lg:max-w-md animate-slide-up" style={{ animationDelay: '80ms' }}>
          {/* Heading */}
          <div className="mb-7 hidden lg:block">
            <h2 className="font-display font-bold text-[#1c1714] text-3xl">
              {mode === 'login' ? 'Welcome back 👋' : 'Create account'}
            </h2>
            <p className="text-[#a39083] mt-1.5">
              {mode === 'login' ? 'Sign in to your CheezyHub account' : 'Join thousands of happy customers'}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex p-1.5 bg-[#ede8e0] rounded-2xl mb-6">
            {(['login','register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-sm font-ui font-bold capitalize transition-all duration-200',
                  mode === m
                    ? 'bg-white text-[#1c1714] shadow-md shadow-black/8'
                    : 'text-[#a39083] hover:text-[#5c5147]'
                )}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Glass card */}
          <div className="glass-card rounded-3xl p-7">
            <div className="flex flex-col gap-4">
              {mode === 'register' && (
                <div className="animate-slide-up">
                  <label className="block text-[10px] font-bold text-[#a39083] mb-1.5 uppercase tracking-widest">Full Name</label>
                  <input
                    className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-[15px] transition-all placeholder:text-[#c4b8ac] font-ui"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-[#a39083] mb-1.5 uppercase tracking-widest">Mobile or Email</label>
                <input
                  className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-[15px] transition-all placeholder:text-[#c4b8ac] font-ui"
                  placeholder="+92 3xx xxxxxxx or email@..."
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#a39083] mb-1.5 uppercase tracking-widest">PIN</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    className="input-glow w-full px-4 py-3.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-[15px] transition-all pr-12 placeholder:text-[#c4b8ac] font-mono tracking-widest"
                    placeholder="••••"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c4b8ac] hover:text-[#5c5147] transition-colors"
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
              className="btn-press mt-6 w-full flex items-center justify-center gap-2.5 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-60 text-white rounded-2xl font-ui font-bold text-[15px] shadow-lg shadow-amber-400/30 transition-all"
            >
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Please wait...</span>
                : <>{mode === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight size={16} /></>
              }
            </button>
          </div>

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
                <Link href={l.href} className="text-amber-600 hover:text-amber-700 font-semibold transition-colors">
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
