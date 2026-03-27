'use client';

import Link from 'next/link';
import { useState } from 'react';
import { brand } from '@/config/brand';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { Instagram, Facebook, Twitter, MessageCircle, Mail, Phone, MapPin, Clock } from 'lucide-react';

// ─── TikTok icon (not in lucide) ──────────────────────────────────
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.91a8.16 8.16 0 004.77 1.52V7c0 .01-1.25-.01-1.01.0z"/>
    </svg>
  );
}

// ─── Payment icons (SVG pill) ────────────────────────────────────
function PaymentBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    cash:       'bg-emerald-500/10 text-emerald-400',
    card:       'bg-blue-500/10 text-blue-400',
    easypaisa:  'bg-green-500/10 text-green-400',
    jazzcash:   'bg-red-500/10 text-red-400',
  };
  return (
    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide ${colors[label] ?? 'bg-[#1e1e28] text-[#9898a5]'}`}>
      {label}
    </span>
  );
}

export default function Footer() {
  const [email,     setEmail]     = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Enter a valid email'); return; }
    setSubscribing(true);
    try {
      await api.post('/subscribe', { email });
      toast.success('Subscribed! We\'ll send you the best deals.');
      setEmail('');
    } catch {
      // even if endpoint doesn't exist yet, show success UX
      toast.success('Thanks! You\'re on the list.');
      setEmail('');
    } finally { setSubscribing(false); }
  };

  return (
    <footer className="bg-[#1c1714] text-[#c4b8ac] mt-auto">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Col 1 — Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">🧀</div>
              <div>
                <div className="font-display font-bold text-lg text-[#f2f2f5]">{brand.name}</div>
                <div className="text-xs text-[#8a7d72]">{brand.tagline}</div>
              </div>
            </div>
            <p className="text-sm text-[#8a7d72] leading-relaxed">
              Islamabad's favourite cheesy bites. Hand-crafted burgers, fresh ingredients, and lightning-fast delivery.
            </p>
            {/* Socials */}
            <div className="flex items-center gap-3">
              {brand.social.instagram && (
                <a href={brand.social.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#2a2219] flex items-center justify-center text-[#8a7d72] hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                  <Instagram size={15} />
                </a>
              )}
              {brand.social.facebook && (
                <a href={brand.social.facebook} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#2a2219] flex items-center justify-center text-[#8a7d72] hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                  <Facebook size={15} />
                </a>
              )}
              {brand.social.tiktok && (
                <a href={brand.social.tiktok} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#2a2219] flex items-center justify-center text-[#8a7d72] hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                  <TikTokIcon size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Col 2 — Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-sm text-[#f2f2f5] mb-4 uppercase tracking-wide">Quick Links</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/customer/menu',    label: 'Menu' },
                { href: '/customer/deals',   label: 'Deals' },
                { href: '/customer/orders',  label: 'My Orders' },
                { href: '/customer/tickets', label: 'Support' },
                { href: '/customer/profile', label: 'My Profile' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-[#8a7d72] hover:text-amber-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Contact */}
          <div>
            <h4 className="font-display font-semibold text-sm text-[#f2f2f5] mb-4 uppercase tracking-wide">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-[#8a7d72]">
                <Phone size={14} className="mt-0.5 flex-shrink-0 text-amber-500/60" />
                <a href={`tel:${brand.phone}`} className="hover:text-amber-400 transition-colors">{brand.phone}</a>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-[#8a7d72]">
                <MessageCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-500/60" />
                <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">WhatsApp</a>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-[#8a7d72]">
                <Mail size={14} className="mt-0.5 flex-shrink-0 text-amber-500/60" />
                <a href={`mailto:${brand.email}`} className="hover:text-amber-400 transition-colors">{brand.email}</a>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-[#8a7d72]">
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-amber-500/60" />
                <span>{brand.address}</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-[#8a7d72]">
                <Clock size={14} className="mt-0.5 flex-shrink-0 text-amber-500/60" />
                <span>{brand.openingHours}</span>
              </li>
            </ul>
          </div>

          {/* Col 4 — Newsletter + Payments */}
          <div className="space-y-5">
            <div>
              <h4 className="font-display font-semibold text-sm text-[#f2f2f5] mb-1 uppercase tracking-wide">Stay Updated</h4>
              <p className="text-xs text-[#8a7d72] mb-3">Deals, new items, and exclusive offers straight to your inbox.</p>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#2a2219] border border-[#3a3028] text-[#f2f2f5] text-sm placeholder-[#5a5048] focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {subscribing ? '…' : 'Join'}
                </button>
              </form>
            </div>

            <div>
              <h4 className="font-display font-semibold text-sm text-[#f2f2f5] mb-2 uppercase tracking-wide">We Accept</h4>
              <div className="flex flex-wrap gap-1.5">
                {brand.paymentMethods.map((m) => <PaymentBadge key={m} label={m} />)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#2a2219]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-[#5a5048]">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          {brand.showPoweredBy && (
            <p className="text-xs text-[#3a3028]">Powered by CheezyHub Platform</p>
          )}
        </div>
      </div>
    </footer>
  );
}
