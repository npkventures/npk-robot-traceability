# Clerk migration preparation

Status, 2026-11-16: migration plan approved by the founder; implementation and cutover pending. This document elaborates [build.md](../build.md) sections 7 and 10. The selected existing application is `app_3MC4Heg7RwlMtMQg8cbysLI7ZVA`. No new Clerk application, users, keys, SDK installation or database changes have been made for this task.

## Inspected dependencies

- npm/package-lock.json, Next.js 16.4.6 and React 19.3.0; no Clerk dependency in the package manifest.
- Root `next.config.ts` uses static export. The combined authenticated server runs from `beta/`; its private and public route groups have separate layouts. CLI-generated root files must be reviewed and placed in the correct server app before activation.
- `lib/beta/auth.ts` and `lib/beta/server.ts` use Supabase user verification, rotating HttpOnly cookies, explicit provider/session approval and recent-authentication checks.
- `beta/app/(private)/app/page.tsx` validates access through the API; `beta/app/workspace-client.tsx` handles session renewal, invitation acceptance and account controls.
- Database memberships, audit authors and downstream records reference `auth.users` UUIDs. `approved_app_sessions` references `auth.sessions`. Organization/project RLS relies on UUID `auth.uid()` and approved session checks. Connector OAuth also retains a UUID session reference.
- User-record schemas were inspected, not live account contents or password hashes. Existing environment files and claim-file contents were not read. No Git directory exists, so no working-tree diff is available.

## Approved execution sequence

1. The founder runs `npx -y clerk@latest auth login` in their own terminal and confirms completion. Do not initiate their browser login through the agent. Both known claim-file paths were absent in root and beta at inspection. Recheck existence before linking if state changes.
2. Use the Clerk CLI with `--app app_3MC4Heg7RwlMtMQg8cbysLI7ZVA`, preserving existing settings and reviewing generated changes. Install Clerk agent skills as authorized. Never select another application or create an accountless replacement. Keep private CLI state excluded before generation. Determine the CLI's handling of this root-package/nested-app layout before mutation.
3. Add the current Next.js provider inside body, `beta/proxy.ts`, sign-in/sign-up routes and account controls in the server app. Keep public demo access. Use Suspense around request-dependent auth UI and preserve the standalone static export. The project has shadcn configuration; apply the matching Clerk theme after SDK generation is known.
4. Implement a protected identity mapping from Clerk issuer/subject to the existing application UUID. Never trust a client-provided UUID or email match to transfer membership. Keep existing historical references intact. New users require stable UUID provisioning and verified-email invitation eligibility; signup grants no organization membership.
5. Adapt server verification and database authorization together. Use the supported Clerk/Supabase third-party integration with a pinned intended issuer. Replace UUID-only identity/session assumptions through explicit mapping and revocation-aware helpers; preserve tenant/project predicates. Do not bypass RLS with privileged reads as a substitute. Keep machine/collector credentials separate. Implement and test new-user foreign-key handling before enabling signup.
6. Prepare a resumable Backend API importer with rate-limit handling, duplicate detection and reconciliation. Preserve each legacy UUID as `external_id` and in the protected mapping. Verify actual password digest algorithms against Clerk's supported hash formats; unsupported or absent digests require recovery, never invented passwords. Keep exports and hashes outside source control, logs and chat. Inventory approved source accounts before import; do not copy real accounts into a development instance. Clerk development users cannot be migrated to production by promoting the instance.
7. Configure OAuth callbacks and consent for the intended Clerk instance. Verify password login, OAuth-only accounts and explicitly linked accounts; do not assume the old Supabase OAuth session or identity approval transfers. Prevent an equal-email identity from silently gaining legacy access. Provider tokens remain separate from robot/CAD authorization.
8. Roll out behind an explicit provider switch after synthetic acceptance. Coordinate a bounded final export/import reconciliation; require fresh sign-in at cutover, expire old browser cookies and revoke old access under the agreed scope. Avoid unrestricted acceptance of both token types. Test rollback with identity mappings and any new users/password changes reconciled; preserve Supabase accounts and data until retirement is explicitly scheduled.

## Verification and outstanding gates

Required: CLI doctor, typecheck and both production builds; sign-in/signup/account controls; existing-user continuity; verified invitations; two-organization and client-project isolation through both API and direct database requests; viewer restrictions; token expiry/revocation/logout; recent-auth requirements; OAuth success/cancellation/mismatch; password recovery; connector session binding; collector and machine regressions. Review the complete changed scope separately after implementation.

Live user inventory, password compatibility, issuer/integration configuration, actual OAuth acceptance, import, session cutover and rollback are unverified. The current blocker for selected-application initialization is founder confirmation of host-terminal CLI authentication. No application tests are claimed by this documentation preparation. Production hosting, recovery and customer evidence gates remain open.

References: [Clerk CLI](https://clerk.com/docs/cli), [migration guide](https://clerk.com/docs/guides/development/migrating/overview), [Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart), [Supabase third-party Clerk auth](https://supabase.com/docs/guides/auth/third-party/clerk).
