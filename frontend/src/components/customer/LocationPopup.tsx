'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Pencil, X, Check, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { addressApi } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Reverse geocode using free Nominatim API ──────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address ?? {};
    const parts = [
      a.house_number,
      a.road || a.pedestrian || a.footway,
      a.neighbourhood || a.suburb || a.quarter,
      a.city || a.town || a.village || a.municipality,
      a.state,
      a.country,
    ].filter(Boolean);
    return parts.slice(0, 5).join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ─── Storage key — shown once per login session ────────
const POPUP_KEY = 'ch_location_popup_shown';

interface Props {
  isAuthenticated: boolean;
}

type Step = 'prompt' | 'detecting' | 'confirm' | 'manual' | 'done';

export default function LocationPopup({ isAuthenticated }: Props) {
  const [visible, setVisible]       = useState(false);
  const [step,    setStep]          = useState<Step>('prompt');
  const [lat,     setLat]           = useState<number | null>(null);
  const [lng,     setLng]           = useState<number | null>(null);
  const [address, setAddress]       = useState('');
  const [saving,  setSaving]        = useState(false);
  const [error,   setError]         = useState('');

  // Manual form
  const [houseNo, setHouseNo] = useState('');
  const [street,  setStreet]  = useState('');
  const [area,    setArea]    = useState('');
  const [city,    setCity]    = useState('');
  const [notes,   setNotes]   = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    const shown = sessionStorage.getItem(POPUP_KEY);
    if (!shown) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated]);

  const dismiss = () => {
    sessionStorage.setItem(POPUP_KEY, '1');
    setVisible(false);
  };

  // ── GPS flow ───────────────────────────────────────────
  const requestGps = () => {
    if (!navigator.geolocation) {
      setError('GPS not supported on this device');
      return;
    }
    setStep('detecting');
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        const readable = await reverseGeocode(latitude, longitude);
        setAddress(readable);
        setStep('confirm');
      },
      (err) => {
        setStep('prompt');
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access denied. Please allow GPS in your browser settings.');
        } else {
          setError('Could not detect location. Try again or enter manually.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ── Save GPS ────────────────────────────────────────────
  const saveGps = async () => {
    if (!lat || !lng) return;
    setSaving(true);
    try {
      await addressApi.saveGps({ latitude: lat, longitude: lng, addressText: address });
      toast.success('📍 Location saved! Checkout will be faster now.', { duration: 3500 });
      setStep('done');
      setTimeout(dismiss, 1400);
    } catch {
      toast.error('Could not save location. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Save Manual ─────────────────────────────────────────
  const saveManual = async () => {
    const parts = [houseNo, street, area, city].filter(Boolean);
    if (parts.length < 2) { setError('Please fill in at least street and city'); return; }
    const addressText = parts.join(', ');
    setSaving(true);
    try {
      await addressApi.create({
        label:       'Home',
        type:        'home',
        addressText,
        houseNo:     houseNo || undefined,
        street:      street  || undefined,
        area:        area    || undefined,
        city:        city    || undefined,
        notes:       notes   || undefined,
        isDefault:   true,
      });
      toast.success('📍 Address saved!', { duration: 3000 });
      setStep('done');
      setTimeout(dismiss, 1400);
    } catch {
      toast.error('Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={step === 'prompt' ? dismiss : undefined}
      />

      {/* Panel — slides up from bottom on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-[201] flex justify-center">
        <div
          className="w-full max-w-md bg-white rounded-t-[2rem] shadow-2xl shadow-black/20 animate-slide-up overflow-hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
          {/* ── Top handle ────────────────────────── */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-10 h-1 bg-[#e5ddd5] rounded-full" />
          </div>

          {/* ── STEP: PROMPT ──────────────────────── */}
          {step === 'prompt' && (
            <div className="px-6 pb-8">
              <div className="flex items-start justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/30 animate-pin-drop">
                  <MapPin size={24} className="text-white" />
                </div>
                <button onClick={dismiss} className="p-2 rounded-xl text-[#a39083] hover:bg-[#f5f0e8] transition-colors">
                  <X size={18} />
                </button>
              </div>

              <h2 className="font-display font-bold text-[#1c1714] text-2xl leading-tight mb-2">
                Enable smart delivery 📍
              </h2>
              <p className="text-[#7a6d63] text-[15px] leading-relaxed mb-6">
                Share your location once to get faster checkout, accurate delivery, and precise driver routing.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-100 mb-4">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {/* GPS button */}
              <button
                onClick={requestGps}
                className="btn-press relative w-full flex items-center gap-4 p-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-semibold text-[15px] shadow-lg shadow-amber-400/30 transition-all mb-3 overflow-hidden"
              >
                {/* Ripple ring */}
                <div className="absolute left-4 w-8 h-8 rounded-full border-2 border-white/30 animate-ripple" />
                <div className="relative z-10 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Navigation size={16} />
                </div>
                <div className="text-left z-10">
                  <div className="font-bold">Use My Current Location</div>
                  <div className="text-amber-100/80 text-xs font-normal mt-0.5">Faster checkout · Better delivery</div>
                </div>
                <ChevronRight size={16} className="ml-auto z-10 opacity-70" />
              </button>

              {/* Manual button */}
              <button
                onClick={() => { setStep('manual'); setError(''); }}
                className="w-full flex items-center gap-4 p-4 bg-[#faf7f2] hover:bg-[#f5f0e8] border border-[#ece6dc] text-[#1c1714] rounded-2xl font-semibold text-[15px] transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-[#ece6dc] flex items-center justify-center flex-shrink-0">
                  <Pencil size={15} className="text-[#7a6d63]" />
                </div>
                <div className="text-left">
                  <div>Enter Address Manually</div>
                  <div className="text-[#a39083] text-xs font-normal mt-0.5">Type your delivery address</div>
                </div>
                <ChevronRight size={16} className="ml-auto text-[#a39083]" />
              </button>

              <button onClick={dismiss} className="w-full text-center text-[#a39083] text-sm mt-4 py-2">
                Skip for now
              </button>
            </div>
          )}

          {/* ── STEP: DETECTING ───────────────────── */}
          {step === 'detecting' && (
            <div className="px-6 pb-10 text-center">
              <div className="relative w-20 h-20 mx-auto mb-5 mt-4">
                <div className="absolute inset-0 rounded-full bg-amber-500/15 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-amber-500/25 animate-ping" style={{ animationDelay: '0.3s' }} />
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-400/30">
                  <Navigation size={28} className="text-white" />
                </div>
              </div>
              <h3 className="font-display font-bold text-[#1c1714] text-xl mb-2">Detecting your location</h3>
              <p className="text-[#a39083] text-sm">Please allow location access in your browser popup</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: CONFIRM GPS ─────────────────── */}
          {step === 'confirm' && (
            <div className="px-6 pb-8">
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center animate-pin-drop">
                  <MapPin size={20} className="text-emerald-500" />
                </div>
                <button onClick={() => setStep('prompt')} className="p-2 rounded-xl text-[#a39083] hover:bg-[#f5f0e8]">
                  <X size={18} />
                </button>
              </div>

              <h3 className="font-display font-bold text-[#1c1714] text-xl mb-1">Location detected!</h3>
              <p className="text-[#7a6d63] text-sm mb-4">Is this your delivery address?</p>

              {/* Address display */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#faf7f2] border border-[#ece6dc] mb-4">
                <MapPin size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-[#1c1714] text-sm font-medium leading-relaxed">{address}</div>
                  {lat && lng && (
                    <div className="font-mono text-[10px] text-[#a39083] mt-1">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </div>
                  )}
                </div>
              </div>

              {/* Edit address text */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-[#a39083] uppercase tracking-wider mb-1.5 block">
                  Confirm or edit address
                </label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-[#ece6dc] bg-white text-[#1c1714] text-sm outline-none focus:border-amber-400 resize-none"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <button
                onClick={saveGps}
                disabled={saving || !address.trim()}
                className="btn-press w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-60 text-white rounded-2xl font-display font-bold text-[15px] shadow-lg shadow-amber-400/25 transition-all mb-3"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Saving...' : 'Confirm This Address'}
              </button>

              <button
                onClick={() => { setStep('manual'); }}
                className="w-full text-center text-amber-600 text-sm font-semibold py-2"
              >
                Enter manually instead
              </button>
            </div>
          )}

          {/* ── STEP: MANUAL ──────────────────────── */}
          {step === 'manual' && (
            <div className="px-6 pb-8">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="font-display font-bold text-[#1c1714] text-xl">Enter your address</h3>
                  <p className="text-[#a39083] text-sm mt-0.5">We'll save this as your default</p>
                </div>
                <button onClick={dismiss} className="p-2 rounded-xl text-[#a39083] hover:bg-[#f5f0e8]">
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 mb-4 text-sm text-red-600">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <div>
                  <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">House / Flat</label>
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-sm outline-none focus:border-amber-400 transition-colors"
                    placeholder="House no."
                    value={houseNo}
                    onChange={(e) => setHouseNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">City <span className="text-red-400">*</span></label>
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-sm outline-none focus:border-amber-400 transition-colors"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-2.5">
                <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Street / Road <span className="text-red-400">*</span></label>
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-sm outline-none focus:border-amber-400 transition-colors"
                  placeholder="Street name"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>

              <div className="mb-2.5">
                <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Area / Sector</label>
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-sm outline-none focus:border-amber-400 transition-colors"
                  placeholder="Area or sector"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>

              <div className="mb-5">
                <label className="text-[10px] font-bold text-[#a39083] uppercase tracking-wider mb-1 block">Delivery Notes</label>
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#ece6dc] bg-[#faf9f6] text-[#1c1714] text-sm outline-none focus:border-amber-400 transition-colors"
                  placeholder="Gate colour, landmark, floor..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                onClick={saveManual}
                disabled={saving}
                className="btn-press w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-2xl font-display font-bold text-[15px] shadow-lg shadow-amber-400/25 transition-all mb-3"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? 'Saving...' : 'Save Address'}
              </button>

              <button
                onClick={() => { setStep('prompt'); setError(''); }}
                className="w-full text-center text-[#a39083] text-sm py-2"
              >
                ← Back
              </button>
            </div>
          )}

          {/* ── STEP: DONE ────────────────────────── */}
          {step === 'done' && (
            <div className="px-6 py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4 animate-bounce-in">
                <Check size={28} className="text-emerald-500" />
              </div>
              <h3 className="font-display font-bold text-[#1c1714] text-xl mb-2">All set! 🎉</h3>
              <p className="text-[#a39083] text-sm">Your address is saved. Checkout will be instant from now on.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
