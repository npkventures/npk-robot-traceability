import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  poweredByHeader: false,
  env: {
    TAVRIK_UNIFIED_SITE: 'true',
    // Public founder addresses already supplied for the marketing website.
    CONTACT_URL: process.env.CONTACT_URL ?? 'mailto:cartercness4@gmail.com,2thomaskelley@gmail.com',
  },
  turbopack: { root: path.resolve(__dirname, '..') },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'Cache-Control', value: 'no-store' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  ] }]; },
};
export default config;
