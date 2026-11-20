# Google and GitHub sign-in

Tavrik uses Supabase Auth, server-only session cookies and organization memberships. Social sign-in grants no organization access by itself. The public synthetic demo remains available without an account. `/app` validates the session on the server and redirects to `/login` when it cannot approve access. Login can renew an expired session through the existing same-origin POST flow.

November 15, 2026 activation: Google is enabled in the selected Supabase project and in the protected local Tavrik server environment. The Google button at `http://127.0.0.1:3002/login` reaches the real Google Accounts sign-in page. GitHub and public registration remain disabled according to live Auth settings. A real completed account login, application callback allowlist acceptance, identity linking and customer readiness are not established by this handoff check.

## Activation

1. Apply `supabase/migrations/20261113202514_github_account_approval.sql` to the intended project before enabling GitHub. It adds a protected identity-approval table/function; existing Google and email approvals remain intact. The migration passed local synthetic database tests and was applied to the selected hosted project on November 13. Live checks confirmed RLS is enabled, authenticated users cannot insert approvals or execute the function, and service_role can execute it. Actual GitHub consent/sign-in remains unverified.
2. Create a Google OAuth **web application** in the intended Google Cloud project and a GitHub **OAuth App** in the intended GitHub account/organization. This is identity sign-in, not an installed GitHub repository integration. No repository scopes are requested.
3. Use the Supabase callback `https://wdwtscztkpqkejkovkob.supabase.co/auth/v1/callback` for the currently selected project. Store each client ID/secret in Supabase Authentication → Providers, never in frontend code or chat.
4. Allow the exact application callback `${BETA_ORIGIN}/api/oauth-callback` in Supabase URL Configuration. For the existing local server this is `http://127.0.0.1:3002/api/oauth-callback`. Configure the final HTTPS origin when supplied; avoid wildcard production callbacks.
5. Enable the matching provider and set `BETA_AUTH_LIFECYCLE=true`, `BETA_GOOGLE_ENABLED=true` and/or `BETA_GITHUB_ENABLED=true` in the protected server environment. Restart the combined server. Leave flags false until setup and migration are complete.
6. Verify actual success, cancellation, expiry, logout, refresh, invitation acceptance and removed membership. For an existing account, first check unapproved automatic linking is refused, then sign in with its password and explicitly approve the provider under Account access. The callback must return that same verified user. Social-only accounts without a password must establish one through the existing recovery flow before this password-proof linking workflow.

State includes the provider, a ten-minute expiry, optional expected user and random PKCE verifier, authenticated with a server signature. The callback validates the returned user and matching provider identity before approving an application session. Provider tokens are discarded. Database approval functions are service-only; direct authenticated database clients cannot approve themselves or bypass organization RLS.

Official setup: [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [GitHub](https://supabase.com/docs/guides/auth/social-sign-in/auth-github). The founder configured Google's credentials in Supabase; no Google secret was copied into Tavrik. GitHub setup, public origin and real end-to-end OAuth acceptance remain outstanding. New Google accounts require registration to be enabled in Supabase; registration never grants organization membership. This does not complete hosting/recovery gates in [build.md](../build.md).

## UI structure

November 15: both signup and sign-in display GitHub and Google buttons before the email form. They use the same existing server OAuth endpoints and availability flags. Unconfigured providers remain visible but disabled with explanatory text; no provider credentials or authorization rules changed.

TypeScript already existed. Shared shadcn components now live in `/components/ui`, with aliases in `components.json`; this makes registry imports resolve consistently. Existing custom components remain in `/app/components`. Tailwind utilities and tokens live in `app/ui.css`, processed by the root and beta PostCSS configurations. Preflight is intentionally omitted to preserve existing site styles.

`BackgroundPaths` accepts `title` and `decorative`; account entry uses the decorative variant behind the real sign-in form. Its standalone variant links to the working demo. It needs no image assets or context provider. The supplied geometry uses deterministic timings, pause control and reduced-motion handling. It imports `motion/react`, already installed, instead of adding the equivalent `framer-motion` package. `button.tsx` uses Radix Slot, class-variance-authority and the shared `cn` helper. No scaffold or destructive shadcn initialization is necessary.
