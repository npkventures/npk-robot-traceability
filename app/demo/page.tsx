import type { Metadata } from 'next';
import SharedDemo from './shared-demo';
import '../local/workspace.css';
export const metadata: Metadata = { title: 'Tavrik · Synthetic demo', robots: { index: false, follow: false } };
export default function DemoPage() { return <SharedDemo />; }
