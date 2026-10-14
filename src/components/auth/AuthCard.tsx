import React from 'react';
import { motion } from 'framer-motion';

/**
 * The sign-in page's dark glass card on its own (LT-315), for the pages a
 * signed-out owner reaches from it: forgot password and reset password.
 * Same background, card and type as the login form's panel, one column at
 * every width. Icons and paddings use logical sides (start/end), so the
 * card reads right to left in Hebrew and Arabic.
 */
export const AuthCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 overlay-safe bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm"
    >
      <div className="flex justify-center mb-6">
        <img src="/lightor-purple.png" alt="Lightor" className="w-14 h-14 object-contain" />
      </div>
      <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.05] shadow-2xl">
        <div className="text-center space-y-1 mb-5">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-white/60 text-xs leading-relaxed">{subtitle}</p>}
        </div>
        {children}
      </div>
    </motion.div>
  </div>
);

/**
 * An input on the dark card, with its icon at the start side. A `dir` goes
 * on the wrapper, not the input, so an LTR email field in a Hebrew page has
 * its icon and its padding on the same side.
 */
export const AuthInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode; end?: React.ReactNode }
>(({ icon, end, dir, className = '', ...props }, ref) => (
  <div className="relative flex items-center" dir={dir}>
    <span className="absolute start-3 text-white/40 pointer-events-none" aria-hidden="true">{icon}</span>
    <input
      ref={ref}
      className={`w-full h-10 rounded-lg border border-transparent bg-white/5 ps-10 ${end ? 'pe-10' : 'pe-3'} text-base md:text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/20 focus:bg-white/10 ${className}`}
      {...props}
    />
    {end && <span className="absolute end-3 flex items-center">{end}</span>}
  </div>
));
AuthInput.displayName = 'AuthInput';

/** The card's main button: white, like "Sign in". */
export const AuthButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }> = ({ busy = false, children, disabled, ...props }) => (
  <button
    type="submit"
    disabled={disabled || busy}
    className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
    {...props}
  >
    {busy && <span className="w-4 h-4 border-2 border-black/70 border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
    {children}
  </button>
);

/** A message box on the card: red for a problem, green for done. */
export const AuthNotice: React.FC<{ tone: 'error' | 'success'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`mb-4 px-3 py-2 rounded-lg border text-xs text-center leading-relaxed ${
      tone === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
    }`}
  >
    {children}
  </div>
);
