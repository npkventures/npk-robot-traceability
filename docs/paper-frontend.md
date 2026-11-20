# Paper frontend workspace

**Archived, 2026-11-18:** The founder discontinued Paper and requested direct application edits. The workflow and resume instructions below describe the previous process only; they are no longer prerequisites or active work. Preserve the partial import as historical material. See [build.md section 10](../build.md) and [AGENTS.md](../AGENTS.md) for current instructions.

Direction: [build.md section 10](../build.md). Effective 2026-11-16, the founder designated Paper as the frontend design workspace.

Active file: [tav2](https://app.paper.design/file/01M7KBYHZBQKPMQ169NAQSEFK2/p-2-0). Preserve existing user work and the three existing color tokens. The current application uses additional colors; this import does not recolor it to the earlier standalone palette.

## Workflow going forward

1. Inspect the relevant Paper page, current selection, tokens and recent user edits.
2. Make requested visual design changes in Paper, preserving product/evidence semantics from the canonical brief.
3. Review screenshots and verify editable text, layout, mobile behavior and important states.
4. When application implementation is requested, read exact JSX/styles/assets from Paper and adapt them to the existing components. Preserve handlers, authorization, validation, accessibility and responsive behavior.
5. Verify the running application separately and record which design changes were implemented. Paper edits do not automatically update application code or deploy a site.

Do not overwrite current Paper edits with an older captured screen. Inspect the existing imported artboard before resuming or replacing a group.

## Import status

Partial import on 2026-11-16. Paper returned: "Weekly MCP limit reached. It resets in 4 days." Further mutations were rejected. The finish-working call succeeded afterward. No plan upgrade or purchase was attempted.

Five desktop artboards were created on **Frontend · Public**:

| Captured screen | Paper artboard | Review |
| --- | --- | --- |
| Home | 11-0 | Editable; text encoding corrected and screenshot rechecked. Carousel geometry still differs from the source. |
| Services | DO-0 | Screenshot reviewed; no visible import defect identified. |
| Configuration history | H4-0 | Editable; transformed layer illustration is distorted and needs correction. |
| Run comparison | MN-0 | Screenshot reviewed; synthetic labels, unknown states and comparison warnings retained. |
| Custom pilot | WE-0 | Screenshot reviewed; custom pricing and proposed-scope language retained. |

Account, Workspace synthetic and Mobile pages were created but remain empty. Nineteen captured artboards still need import:

- Walkthrough, Sectors, Robotic manipulation, About, Contact, Security and Compatibility.
- Sign in, Sign up and Password reset.
- Synthetic workspace empty, comparison, hardware record, test run record and snapshot history.
- Mobile Home, Sign in, Sign up and empty workspace at 390px.

The local package is `.cache/paper-import/`: per-screen editable HTML groups in JSON, source browser PNG references, HTML previews, index and manifest. `.cache/paper-frontend-import.zip` is a portable copy. `resume.json` records completed artboard IDs and page IDs; use it to avoid duplicate imports. Generated artifacts are ignored by existing repository exclusions. There is no Git metadata/diff in this workspace.

## Fidelity and coverage limits

These are static editable screen snapshots, not an imported React application. Text, shapes and controls are editable design nodes. Captured text is split into rendered lines to retain layout. Absolute positioning represents each captured viewport; it does not establish responsive auto-layout. Animation, events, form submission, authentication, data persistence and navigation still run only in the application.

Capture used an isolated browser, reduced motion, the existing combined production build at loopback port 3002 and only public/synthetic views. All 24 route/state captures completed. No forms were submitted and no real customer records or credentials were copied. The server could not read the protected environment file; account captures show the unavailable-service/provider state and do not establish live provider configuration. Authenticated organization administration, invitations, integrations and other private states were not captured. Further private UI capture should use explicit synthetic fixtures, not customer sessions.

Known P2 import defects: the homepage carousel's transform origin/scale differs in Paper, and the configuration-history illustration's 3D transforms did not transfer faithfully. The attempted final corrections were rejected by the quota, so these are not fixed. Source screenshots remain available for comparison. Keep the limitation visible until corrected; do not claim pixel-perfect import.

## Resume

When Paper access is available, re-read the current file and inspect the five existing artboards. Fix the two transformed illustrations and verify their screenshots before continuing. Prefer native rotated shapes for the carousel; for the 3D illustration, use editable vector geometry or a clearly identified image reference if the canvas cannot represent its CSS perspective. Import remaining JSON groups incrementally into their designated pages. Verify every completed artboard and preserve all synthetic/provenance/evidence labels. Capture any additional private states with synthetic fixtures as a separate clearly scoped continuation. No application build, deployment or customer-validation claim follows from this import.
