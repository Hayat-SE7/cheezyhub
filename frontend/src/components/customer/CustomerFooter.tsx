'use client';

import Link from 'next/link';
import { brand } from '@/config/brand';
import {
  MapPin, Clock, Phone, Mail,
  Instagram, Twitter,
  MessageCircle, // WhatsApp stand-in
  ExternalLink,
  Heart,
} from 'lucide-react';

// ─── Social icon helpers ───────────────────────────────────
// Using lucide approximations since lucide-react doesn't ship
// brand icons. Replace with react-icons if you add the package.
function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
    </svg>
  );
}

// ─── Main Footer ───────────────────────────────────────────
export default function CustomerFooter() {
  const year = new Date().getFullYear();

  const quickLinks = [
    { href: '/customer',         label: 'Menu' },
    { href: '/customer/orders',  label: 'Track Order' },
    { href: '/customer/profile', label: 'My Account' },
    { href: '/customer/support', label: 'Support' },
  ];

  const legalLinks = [
    { href: brand.legal.privacy, label: 'Privacy Policy' },
    { href: brand.legal.terms,   label: 'Terms of Service' },
    { href: brand.legal.refund,  label: 'Refund Policy' },
  ];

  const socials = [
    brand.social.instagram && {
      href: brand.social.instagram,
      icon: Instagram,
      label: 'Instagram',
    },
    brand.social.facebook && {
      href: brand.social.facebook,
      icon: FacebookIcon,
      label: 'Facebook',
    },
    brand.social.tiktok && {
      href: brand.social.tiktok,
      icon: TikTokIcon,
      label: 'TikTok',
    },
    brand.social.twitter && {
      href: brand.social.twitter,
      icon: Twitter,
      label: 'Twitter',
    },
  ].filter(Boolean) as { href: string; icon: any; label: string }[];

  return (
    <footer className="w-full mt-auto">
      {/* ── Divider wave ───────────────────────────────── */}
      <div className="w-full overflow-hidden leading-none">
        <svg
          viewBox="0 0 1440 40"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full block"
          preserveAspectRatio="none"
        >
          <path
            d="M0,20 C240,40 480,0 720,20 C960,40 1200,0 1440,20 L1440,40 L0,40 Z"
            fill="#1c1714"
            fillOpacity="0.04"
          />
        </svg>
      </div>

      {/* ── Main footer body ───────────────────────────── */}
      <div
        className="bg-[#1c1714] text-white/80"
        style={{ fontFamily: 'var(--font-ui)' }}
      >
        <div className="max-w-lg mx-auto px-5 pt-10 pb-6">

          {/* ── Brand column ─────────────────────────────── */}
          <div className="mb-8">
            {/* Logo + name */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-lg shadow-lg shadow-amber-500/30 flex-shrink-0">
                {brand.logoUrl
                  ? <img src={brand.logoUrl} alt={brand.name} className="w-7 h-7 object-contain" />
                  : brand.logoEmoji
                }
              </div>
              <div>
                <div className="font-bold text-white text-[17px] leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {brand.name}
                </div>
                <div className="text-white/40 text-xs mt-0.5">{brand.tagline}</div>
              </div>
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-2 mt-4">
              <a
                href={`tel:${brand.supportPhone}`}
                className="flex items-center gap-2.5 text-sm text-white/55 hover:text-amber-400 transition-colors group"
              >
                <Phone size={13} className="text-amber-500/70 flex-shrink-0 group-hover:text-amber-400" />
                {brand.supportPhone}
              </a>
              <div className="flex items-start gap-2.5 text-sm text-white/55">
                <MapPin size={13} className="text-amber-500/70 flex-shrink-0 mt-0.5" />
                {brand.address}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-white/55">
                <Clock size={13} className="text-amber-500/70 flex-shrink-0" />
                {brand.openingHours}
              </div>
              {brand.email && (
                <a
                  href={`mailto:${brand.email}`}
                  className="flex items-center gap-2.5 text-sm text-white/55 hover:text-amber-400 transition-colors group"
                >
                  <Mail size={13} className="text-amber-500/70 flex-shrink-0 group-hover:text-amber-400" />
                  {brand.email}
                </a>
              )}
            </div>

            {/* Social icons */}
            {socials.length > 0 && (
              <div className="flex items-center gap-2 mt-5">
                {socials.map(({ href, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-8 h-8 rounded-xl bg-white/6 hover:bg-amber-500/20 border border-white/8 hover:border-amber-500/30 flex items-center justify-center text-white/40 hover:text-amber-400 transition-all"
                  >
                    <Icon size={14} />
                  </a>
                ))}

                {/* WhatsApp — always show if configured */}
                {brand.whatsapp && (
                  <a
                    href={`https://wa.me/${brand.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="w-8 h-8 rounded-xl bg-white/6 hover:bg-green-500/20 border border-white/8 hover:border-green-500/30 flex items-center justify-center text-white/40 hover:text-green-400 transition-all"
                  >
                    <MessageCircle size={14} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── Two-column links ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-white/8">
            {/* Quick Links */}
            <div>
              <div className="text-[10px] font-bold text-amber-500/80 uppercase tracking-[0.12em] mb-3">
                Quick Links
              </div>
              <ul className="flex flex-col gap-2">
                {quickLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-white/50 hover:text-white/90 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <div className="text-[10px] font-bold text-amber-500/80 uppercase tracking-[0.12em] mb-3">
                Legal
              </div>
              <ul className="flex flex-col gap-2">
                {legalLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-white/50 hover:text-white/90 transition-colors inline-flex items-center gap-1"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Bottom bar ───────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-white/25">
              © {year} {brand.name}. All rights reserved.
            </p>
            {brand.showPoweredBy && (
              <p className="text-xs text-white/20 flex items-center gap-1">
                Made with <Heart size={10} className="text-amber-600/60 inline" fill="currentColor" /> by CheezyHub SaaS
              </p>
            )}
          </div>

        </div>
      </div>
    </footer>
  );
}
