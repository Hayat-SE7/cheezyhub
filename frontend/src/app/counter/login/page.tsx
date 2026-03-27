'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useCounterStore } from '@/store/counterStore';
import { Delete, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function CounterLoginPage() {
  const router       = useRouter();
  const loginCounter = useCounterStore((s) => s.loginCounter);

  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState<'username' | 'pin'>('username');
  const [shake,    setShake]    = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleUsernameSubmit = () => {
    if (!username.trim()) { triggerShake(); toast.error('Enter your username'); return; }
    setStep('pin');
  };

  const appendDigit = (d: string) => {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  const handleLogin = useCallback(async (finalPin: string) => {
    if (finalPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (!username.trim()) { toast.error('Username missing'); return; }

    setLoading(true);
    try {
      const res  = await authApi.login({ identifier: username.trim(), pin: finalPin, role: 'staff' });
      const data = res.data.data;

      if (data.user.role !== 'cashier' && data.user.role !== 'admin') {
        toast.error('Access denied — cashier account required');
        setPin('');
        setLoading(false);
        return;
      }

      loginCounter(data.token, data.user);
      toast.success(`Welcome, ${data.user.username ?? data.user.name ?? 'Cashier'}!`);
      router.push('/counter');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Invalid credentials');
      triggerShake();
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [username, loginCounter, router]);

  useEffect(() => {
    if (pin.length === 6) handleLogin(pin);
  }, [pin, handleLogin]);

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 overflow-hidden relative">

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-orange-600/5 blur-[100px]" />
      </div>

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-[360px]">

        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-2xl bg-amber-400/20 blur-xl scale-150" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl shadow-2xl shadow-amber-500/30">
              🧀
            </div>
          </div>
          <div className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            CheezyHub
          </div>
          <div className="text-[#3a3a48] text-xs font-mono tracking-[0.2em] uppercase mt-1">
            Point of Sale
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0f0f11] border border-[#1c1c22] rounded-3xl overflow-hidden shadow-2xl shadow-black/60">

          {/* Top accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

          <div className="p-7">

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300',
                step === 'username' ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-500'
              )}>1</div>
              <div className={clsx(
                'flex-1 h-px transition-all duration-500',
                step === 'pin' ? 'bg-amber-500/40' : 'bg-[#1c1c22]'
              )} />
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300',
                step === 'pin' ? 'bg-amber-500 text-black' : 'bg-[#1c1c22] text-[#3a3a48]'
              )}>2</div>
            </div>

            {/* ── STEP 1: USERNAME ── */}
            {step === 'username' && (
              <div className={clsx('space-y-4', shake && '[animation:shake_0.4s_ease]')}>
                <div>
                  <label className="block text-[10px] font-mono text-[#3a3a48] uppercase tracking-[0.15em] mb-2">
                    Staff Username
                  </label>
                  <input
                    autoFocus
                    className="w-full px-4 py-3.5 rounded-xl bg-[#0a0a0b] border border-[#222228] text-[#f0f0f3] text-sm outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-[#2a2a35] font-mono tracking-wide"
                    placeholder="e.g. cashier1"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUsernameSubmit()}
                  />
                </div>
                <button
                  onClick={handleUsernameSubmit}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black rounded-xl font-black text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20"
                >
                  Continue →
                </button>
              </div>
            )}

            {/* ── STEP 2: PIN ── */}
            {step === 'pin' && (
              <div>
                <button
                  onClick={() => { setStep('username'); setPin(''); }}
                  className="flex items-center gap-1.5 text-[11px] text-[#3a3a48] hover:text-amber-500 transition-colors mb-5 font-mono"
                >
                  ← <span className="text-[#5a5a68]">{username}</span>
                </button>

                <label className="block text-[10px] font-mono text-[#3a3a48] uppercase tracking-[0.15em] mb-4">
                  Enter PIN
                </label>

                {/* PIN dots */}
                <div className={clsx(
                  'flex justify-center gap-3 mb-6',
                  shake && '[animation:shake_0.4s_ease]'
                )}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'w-3 h-3 rounded-full transition-all duration-150',
                        i < pin.length
                          ? 'bg-amber-400 scale-110 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                          : 'bg-[#1e1e26] border border-[#2a2a35]'
                      )}
                    />
                  ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2.5">
                  {KEYS.map((key, i) => {
                    if (key === '') return <div key={i} />;
                    const isBack = key === '⌫';
                    return (
                      <button
                        key={key + i}
                        onClick={() => isBack ? backspace() : appendDigit(key)}
                        disabled={loading}
                        className={clsx(
                          'h-14 rounded-xl font-bold text-lg transition-all duration-100 active:scale-90 disabled:opacity-30',
                          isBack
                            ? 'bg-transparent text-[#3a3a48] hover:text-red-400 hover:bg-red-500/10'
                            : 'bg-[#161618] border border-[#222228] text-[#d0d0d8] hover:bg-[#1e1e22] hover:border-amber-500/30 hover:text-amber-400 shadow-sm'
                        )}
                      >
                        {isBack ? <Delete size={18} className="mx-auto" /> : key}
                      </button>
                    );
                  })}
                </div>

                {pin.length >= 4 && pin.length < 6 && (
                  <button
                    onClick={() => handleLogin(pin)}
                    disabled={loading}
                    className="w-full mt-4 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying...</> : 'Login'}
                  </button>
                )}

                {loading && pin.length === 6 && (
                  <div className="flex justify-center mt-5">
                    <Loader2 size={18} className="animate-spin text-amber-500" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-7 pb-5 pt-1 border-t border-[#141418]">
            <p className="text-center text-[10px] text-[#1e1e28] font-mono tracking-wider">
              CHEEZYHUB · COUNTER TERMINAL
            </p>
          </div>
        </div>

        <p className="text-center text-[#1e1e28] text-[10px] font-mono mt-5 tracking-widest">
          AUTHORIZED STAFF ONLY
        </p>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
