# One website, private team access

The `beta/` Next.js server now serves the public Tavrik website and authenticated product at one origin. This implements the founder's November 9 and November 18 directions in [build.md](../build.md). The root static export remains a standalone public preview; it cannot run authentication or private APIs.

| Path | Behavior |
| --- | --- |
| `/` and public business pages | Minimal website, booking and Sign in; a valid session changes the entry to Open workspace |
| `/login` | Sign in, registration, email confirmation and recovery handling |
| `/app` | Server validates the session; anonymous/invalid sessions redirect to `/login`, and records require current organization membership |
| `/demo` | Fixed synthetic reader using the shared light workspace; no imports, persistence or integration operations |
| `/api/*` | Existing authenticated server endpoints and permission checks |

Public and private routes use separate root layouts to isolate their styles. Moving between those sections loads a fresh document on the same origin. Existing cookies stay on that origin. No private records appear in the public homepage or server-rendered workspace shell. `/local` and `/workspace` are not exposed by this server.

## After a demo

1. Agree on the team, permitted data and pilot scope. Complete the customer-hosting gates before using real records.
2. Have the team's designated owner register and verify their actual email. Signup does not grant access. For a new team, an administrator must bootstrap its organization, owner membership and empty workspace using the transaction in [private-beta.md](private-beta.md). There is no founder provisioning screen or automatic booking-to-account integration.
3. The verified owner signs in at `/login`, opens their team, chooses **History and team tools**, and opens **Manage team and collector access**. Enter the colleague's exact email and Member or Viewer role, then choose **Create invitation**.
4. Copy the **Invitation link** and share it privately through an authorized channel. Tavrik does not email it automatically. The token appears once, expires after seven days, can be revoked, and is bound to the verified invited email. Only its hash is stored in the database.
5. The colleague opens the link, signs in (or registers and verifies), explicitly chooses **Accept invitation**, then opens their sole organization automatically or chooses among multiple memberships. If email confirmation opens a separate tab, reopen the invitation link in that tab. Pending invitation tokens are retained in tab session storage across same-tab authentication/reloads, removed on acceptance/sign-out. Separate-tab email confirmation requires reopening the invitation link.
6. They work in `/app`. **Save to organization** persists a draft; returning users sign in or use **Open workspace**. Signing out clears the visible workspace and session through the existing server flow.

The invitation lives in the URL fragment, which is not sent in HTTP requests. The page removes it immediately and also handles a new invitation opened while already on the sign-in screen. It is still a secret: do not paste invitation links into public channels, analytics, bug reports or version control. Accepting is explicit and never bypasses the server's email, expiry, single-use or membership checks.

## Run and deploy the combined site

Use `npm run dev` (or `npm run dev:beta`) locally at `http://127.0.0.1:3002`. For a production build, use `npm run build:beta` and `npm run start:beta` behind the selected HTTPS host. The server imports shared source from the repository root, so the deployment must include the repository, its root dependencies and `beta/`; uploading only `beta/` or `out/` is insufficient. Keep secrets in server configuration, not public assets.

Set `BETA_ORIGIN` to the exact origin used by the browser, with no path or trailing slash. Set `SITE_URL` to the same final public HTTPS origin for marketing metadata. Configure the existing private-server keys and feature flags as described in [private-beta.md](private-beta.md), preserving its activation gates. Public `CONTACT_URL` defaults to the founder-supplied email recipients. Book a demo defaults to `https://cal.com/npk-cnesstkcp/15min`; optional `SCHEDULING_URL` overrides this, while an explicitly empty value restores the email fallback. Public settings require rebuilding. Cal.com availability and confirmation delivery require separate acceptance; the link grants no product access.

Supabase's exact allowed email redirect must include `BETA_ORIGIN/login`. Keep email confirmation enabled. Google, if separately activated, uses `BETA_ORIGIN/api/oauth-callback` and returns to `/app`. The homepage forwards older email-token fragments to `/login` for compatibility. Do not accept arbitrary user-supplied redirect destinations. See [Supabase redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).

## Verification and remaining live gates

Local browser tests cover the combined route map, mobile account entry, sign-in, explicit invitation acceptance, workspace access and sign-out with mocked services. Separate backend/PostgreSQL tests verify email-bound, single-use and revoked invitations, organization isolation and permission enforcement. These do not prove actual inbox delivery or deployed HTTPS behavior.

The November 8 read-only provider check found email enabled, confirmation required, **signup disabled**, and Google disabled. No provider setting was changed or message sent. That dated observation is not a current settings audit; self-registration requires enabled signup and verified email delivery. A final domain/host, exact redirect configuration, SMTP/inbox verification and operational/recovery acceptance remain required. Booking does not activate an account, charge a customer or create a team automatically.

Current correction and verification scope: [Product entry and access correction](product-readiness-correction.md). Historical provider observations above are dated evidence, not a fresh provider-settings audit.
