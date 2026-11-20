# Tav Chrome extension

This implements the founder’s cross-site extension request under [build.md](../build.md) sections 6–7 and 10. It adds reviewed metadata capture to the existing record workflow. It is not an automatic error-finding agent or a live CAD integration.

## Install and use

Download `/downloads/tav-chrome-extension.zip` from the application’s `/extensions/` page, extract it, open `chrome://extensions`, enable Developer mode, and Load unpacked the folder containing `manifest.json`. Developers may load `extensions/chrome` directly. Pin **Tav — Browser capture** using Chrome’s Extensions menu. The package is not published in the Chrome Web Store.

On an ordinary HTTP/HTTPS site, click Tav. The popup reads the active tab’s URL/title, removes URL credentials/query/fragment, and lets the engineer review the remaining reference and label. Enter a component, field label, stable field ID, text version/value, author and real/synthetic designation. Review every field before approving the download. Reuse the same stable field ID and labels across captures to compare the same version field. Changing its meaning requires a new ID.

Keep capture files outside the repository. In the local or private-beta workspace select a robot, expand **Import Chrome capture**, choose the downloaded JSON, review it, and add the snapshot. Imported browser metadata is engineer-entered; its page observation time is not the physical change time. Recording time is assigned on import. URL references are text, never fetched. Availability remains unverified, and unsupplied core configuration stays unknown. The exact new snapshot is selected in the test draft; no outcome is inferred. Export the local workspace or explicitly save the beta organization draft to persist it.

## Boundaries and permissions

- Manifest V3; only `activeTab` and `downloads` permissions. No host permissions, background worker, content scripts, external messaging or remote code. The popup CSP blocks network connections.
- One extension works across ordinary HTTP/HTTPS sites without site-specific adapters. Browser/internal/extension/store/local-file pages are excluded. Managed browsers may block local installation.
- Only tab title/URL and manually entered, approved text metadata are captured. No DOM scraping, selected-text collection, cookies, form inputs, browsing history or automatic upload. Paths and page labels can themselves be sensitive; stripping URL parameters does not replace review.
- Drafts exist only in popup memory. Closing it loses the draft. Downloads require an explicit save dialog; verify completion. Remove through Chrome’s extension manager; downloads are not deleted automatically.
- Capture envelopes are bounded to 16 KiB with an explicit field allowlist. Synthetic and real workspace records cannot mix. Duplicate capture IDs are idempotent; altered/reassigned IDs are rejected. Historical runs keep exact snapshot revisions. Authors are reported, not authenticated by the extension; beta save attribution remains separate.
- This is local distribution, not store approval, customer validation, domain acquisition or a public deployment. No causal diagnosis or robot commands.

## Development and checks

`npm run package:extension` builds a deterministic ZIP from exactly five reviewed source files. `node scripts/package-extension.mjs --check` detects stale packages. No private captures, environment files or dependencies are included. Rebuild after extension source changes and reload the unpacked extension.

`node --experimental-strip-types --test tests/browser-capture.test.mjs` checks input rejection, provenance, round trips, immutable run references, idempotency, version comparison and the distribution package. Browser checks are in `tests/extension-browser/`; use `npm run test:extension`. Their exact results and environment limitations belong in [build progress](build-progress.md).

References: [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [loading an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [Playwright extension testing](https://playwright.dev/docs/chrome-extensions).
