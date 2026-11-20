import { MarketingShell } from '../marketing-shell';
export default function PreviewAccount() {
  return <MarketingShell active="Account"><section className="m-intro m-wrap"><h1>Open your team’s product site</h1><p>This standalone preview has no account server or customer records. Sign in through your team’s configured product site.</p><p>For local development, run <code>npm run dev</code> and open <a href="http://127.0.0.1:3002/login">the local product sign-in</a>.</p><a href="/demo/">Explore the public synthetic demo</a></section></MarketingShell>;
}
