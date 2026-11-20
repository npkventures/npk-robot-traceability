'use client';
import Workspace from '../local/workspace';

export default function SharedDemo() {
  return <><header className="local-header"><a className="wordmark" href="/">Tavrik</a><span className="demo-label">Demo · Invented data</span><nav aria-label="Demo navigation"><a href="/login/">Sign in</a><a href="/login/?mode=signup">Get started</a></nav></header><Workspace demo /></>;
}
