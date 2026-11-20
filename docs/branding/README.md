# Tav logo options

Visual explorations under [build.md section 10](../../build.md#10-current-truth-decisions-and-maintenance).

- [Option 1](option-1.json): linked frames with bold Helvetica Neue lettering.
- [Option 2](option-2.json): stacked geometric layers with bold Trebuchet MS lettering. This is the retained second attempt; the earlier solid-T design was rejected.
- [Option 3](option-3.json): an open hexagonal connection symbol with spaced uppercase sans-serif lettering.

**Selected: Option 2 symbol + Option 3 lettering (2026-11-20).** The shared header/footer keeps Option 2's stacked layers, icon sizing and gap, with Option 3's exact `.m-wordmark` rule (uppercase Arial/Helvetica, weight 600 and .075em spacing). The favicon remains Option 2. Original saved options are unchanged.

Each saved JSON contains the exact `TavWordmark` component, three scoped CSS rules and browser icon. To restore an option, replace only `TavWordmark` in `app/components/tav-wordmark.tsx` with `component` (retain its default export), the three matching rules in `app/marketing.css` with `cssRules`, and both `public/icon.svg` and `beta/public/icon.svg` with `favicon`. Preserve other file contents. Run TypeScript and inspect the local page afterward. Do not restore entire application files or revert unrelated work.

These are local design options, not a published brand release.
