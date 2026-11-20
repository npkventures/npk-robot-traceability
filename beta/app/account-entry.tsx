'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import './account-entry.css';
import { BackgroundPaths } from '@/components/ui/background-paths';

type Mode = 'login' | 'signup' | 'recover' | 'password';
export default function AccountEntry({ available, googleAvailable = false, githubAvailable = false, initialMode = 'login', accountId = '', onSignedIn, onPasswordSaved }: { available: boolean; googleAvailable?: boolean; githubAvailable?: boolean; initialMode?: Mode; accountId?: string; onSignedIn: () => Promise<void>; onPasswordSaved: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState(''), [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [emailNotice, setEmailNotice] = useState(false);
  const reduced = useReducedMotion();
  const notice = useRef<HTMLElement>(null);
  const cardTitle = useRef<HTMLHeadingElement>(null);
  const hasNotice = emailNotice && Boolean(message);
  useEffect(() => { if (hasNotice) notice.current?.focus(); }, [hasNotice]);
  function dismissNotice() { setEmailNotice(false); setMessage(''); requestAnimationFrame(() => cardTitle.current?.focus()); }
  function change(next: Mode) { setEmailNotice(false); setMode(next); setError(''); setMessage(''); setShow(false); }
  async function submit(path: string, body: unknown) {
    const response = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(path === 'password' && accountId ? { 'X-Tavrik-Account': accountId } : {}) }, body: JSON.stringify(body), cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to continue. Please try again.'); return data;
  }
  const title = { login: 'Welcome back', signup: 'Create your account', recover: 'Reset your password', password: 'Choose a new password' }[mode];
  return <MotionConfig reducedMotion="user" transition={{ type: "spring", bounce: 0.2, visualDuration: 0.4 }}><main className="account-layout"><BackgroundPaths decorative /><aside className="account-intro"><p className="account-eyebrow">YOUR ROBOT’S ENGINEERING HISTORY</p><h1>Keep the setup.<br />Understand the changes.</h1><p>Record configurations, compare test runs, and keep the evidence behind every investigation.</p><a href="/demo">Try the demo without signing in →</a><p className="account-note">The demo uses synthetic records. Your team’s saved records stay in its private workspace.</p></aside>
    <div className="account-stack"><motion.div className="account-card" inert={hasNotice} aria-hidden={hasNotice || undefined} animate={{ opacity: hasNotice ? 0.6 : 1, scale: hasNotice && !reduced ? 0.95 : 1, y: hasNotice && !reduced ? -10 : 0 }}><h2 ref={cardTitle} tabIndex={-1}>{title}</h2><p>{mode === 'signup' ? 'Choose an available signup method below. Join your team with an invitation after verifying your account.' : mode === 'recover' ? 'We’ll send a link to your email so you can choose a new password.' : mode === 'password' ? 'Use a unique password with at least 8 characters.' : 'Sign in to your team’s saved robot records.'}</p>
      {['login', 'signup'].includes(mode) && <>
        <div className="account-mode" aria-label="Account options">
          <button type="button" aria-pressed={mode === 'signup'} disabled={busy} onClick={() => change('signup')}>Sign up</button>
          <button type="button" aria-label="Switch to sign in" aria-pressed={mode === 'login'} disabled={busy} onClick={() => change('login')}>Sign in</button>
        </div>
        <div className="account-providers">
          {(['github', 'google'] as const).map(provider => {
            const enabled = provider === 'google' ? googleAvailable : githubAvailable;
            const label = provider === 'google' ? 'Google' : 'GitHub';
            return <div key={provider}>
              <button type="button" className="account-provider" disabled={busy || !available || !enabled} aria-describedby={!enabled ? `${provider}-availability` : undefined} onClick={async () => {
                setBusy(true); setError('');
                try { const data = await submit(provider, {}); window.location.assign(data.url); }
                catch (e) { setError(e instanceof Error ? e.message : 'Provider sign-in unavailable.'); setBusy(false); }
              }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">{provider === 'github' ? <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.73 2.63 1.23 3.27.94.1-.73.39-1.23.71-1.51-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.97 0 0 .95-.31 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.46 3.08-1.15 3.08-1.15.62 1.54.23 2.68.12 2.97.72.79 1.15 1.8 1.15 3.03 0 4.32-2.64 5.27-5.15 5.55.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" /> : <><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"/></>}</svg>
                Continue with {label}
              </button>
              {!enabled && <p id={`${provider}-availability`} className="account-provider-status">{label} signup is not available yet.</p>}
            </div>;
          })}
        </div>
        <div className="account-divider"><span>or continue with email</span></div>
      </>}
      <form key={mode} aria-label={title} onSubmit={async e => {
        e.preventDefault(); const form = e.currentTarget, values = new FormData(form); setError(''); setMessage('');
        const password = values.get('password');
        if (['signup', 'password'].includes(mode) && password !== values.get('confirm')) { setError('The passwords do not match.'); return; }
        setBusy(true);
        try {
          const data = await submit(mode, { email, password });
          form.reset();
          if (mode === 'login') await onSignedIn();
          else if (mode === 'password') { change('login'); onPasswordSaved(); setMessage('Password saved. Sign in with your new password.'); }
          else { setMessage(data.message); setEmailNotice(true); }
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to continue.'); } finally { setBusy(false); }
      }}>
        {mode !== 'password' && <label>Email<input disabled={!available || busy} required name="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} /></label>}
        {mode !== 'recover' && <><label>Password<input disabled={!available || busy} required name="password" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 8} maxLength={1024} aria-describedby={mode === 'login' ? undefined : 'password-help'} /></label>
          {mode !== 'login' && <><p id="password-help" className="account-note">At least 8 characters. A long, unique passphrase works well.</p><label>Confirm password<input disabled={!available || busy} required name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={1024} /></label></>}
          <button className="account-text-button" type="button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide passwords' : 'Show passwords'}</button></>}
        {error && <p role="alert" className="beta-error">{error}</p>}{message && !hasNotice && <p role="status">{message}</p>}
        <button className="account-primary" disabled={busy || !available}>{busy ? 'Please wait…' : { login: 'Sign in', signup: 'Create account', recover: 'Send reset link', password: 'Save password' }[mode]}</button>
      </form>
      <div className="account-links">{mode === 'login' ? <><button disabled={busy} onClick={() => change('recover')}>Forgot password?</button><button disabled={busy} onClick={() => change('signup')}>New here? Create an account</button></> : mode !== 'password' && <button disabled={busy} onClick={() => change('login')}>Back to sign in</button>}
        {['signup','login'].includes(mode) && <button disabled={busy || !available || !email} onClick={async () => { setBusy(true); setError(''); try { const d = await submit('resend-confirmation', { email }); setMessage(d.message); setEmailNotice(true); } catch(e) { setError(e instanceof Error ? e.message : 'Unable to send confirmation.'); } finally { setBusy(false); } }}>Resend confirmation email</button>}
      </div>
    </motion.div>
      <AnimatePresence>
        {hasNotice && <motion.section key="email-notice" ref={notice} tabIndex={-1} className="account-card account-card-overlay" aria-labelledby="email-notice-title" initial={{ opacity: 0, y: reduced ? 0 : 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : 30 }}>
          <span className="account-mail-mark" aria-hidden="true">@</span>
          <h2 id="email-notice-title">{mode === 'login' ? 'Check your email' : 'Check your inbox'}</h2>
          <p role="status">{message}</p>
          <p className="account-note">{mode === 'recover' ? 'Use the reset link to choose a new password.' : 'If you received a confirmation link, open it to verify your email.'}</p>
          <button type="button" className="account-primary" onClick={dismissNotice}>Back to {mode === 'signup' ? 'create account' : mode === 'recover' ? 'password reset' : 'sign in'}</button>
        </motion.section>}
      </AnimatePresence>
    </div></main></MotionConfig>;
}
