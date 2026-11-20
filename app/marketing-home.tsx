import Link from 'next/link';
import { HeroSonar } from './components/hero-sonar';
import ScrollReveal from './components/ScrollReveal';
import './home-motion.css';
import { TypingAnimation } from './components/typing-animation';
import { InvestigationPrompt } from './components/investigation-prompt';
import { DeveloperTools, OfferingsCarousel } from './components/home-presentation';
import AnimatedContent from './components/AnimatedContent';
import { MarketingShell } from './marketing-shell';
import { demoRecords } from '../lib/demo/fixtures';
import { compareRuns, formatField } from '../lib/demo/records';
import { readDemoBooking } from '../lib/site-config.mjs';

export default function MarketingHome() {
  const baseline = demoRecords.runs.find(run => run.id === 'run-042')!;
  const target = demoRecords.runs.find(run => run.id === 'run-043')!;
  const comparison = compareRuns(demoRecords, baseline, target);
  const rows = comparison.rows.filter(row => ['hardware', 'firmware', 'calibration', 'model', 'lineage'].includes(row.key));
  const booking = readDemoBooking();
  return <MarketingShell active="Home">
    <HeroSonar><section className="t-hero m-wrap">
      
      <p className="t-build-faster"><TypingAnimation>Build faster</TypingAnimation></p>
      <h1 data-hero>Know what changed.<br /><span>Keep the setup that worked.</span></h1>
      <p className="t-lead" data-hero>The hardware, software, and calibration behind every test.<br className="t-desktop" /> One shared record to start your next investigation.</p>
      <div className="t-actions" data-hero><a className="t-button" href="/login/?mode=signup">Get started <span aria-hidden="true">↗</span></a><Link className="t-secondary" href="/demo/">Explore the working demo <span aria-hidden="true">→</span></Link></div>
      
      <Link className="t-local" href="/login">Already have an account? Sign in <span aria-hidden="true">↗</span></Link>

    </section></HeroSonar>

    <section className="t-workflow m-wrap" aria-labelledby="workflow-title">
      <div className="t-section-heading"><ScrollReveal id="workflow-title" containerClassName="t-workflow-reveal" baseOpacity={.35} baseRotation={0} enableBlur={false} baseOffset={12} wordAnimationEnd="top 35%">The whole investigation. Already connected.</ScrollReveal></div>
      <OfferingsCarousel />
    </section>

    <section className="t-product m-wrap" aria-label="Synthetic product preview">
      <InvestigationPrompt />
      <AnimatedContent distance={90} scale={0.94} duration={1} animateOpacity={false} data-animated-content><div className="t-window" data-hero-art>
        <div className="t-window-bar"><span className="t-window-dots" aria-hidden="true"><i /><i /><i /></span><span>Tav / Test history</span><span className="t-example">Synthetic example</span></div>
        <div className="t-app-layout">
          <aside className="t-app-sidebar" aria-label="Preview context"><strong>Tav<span> / </span></strong><p>ROBOT RECORDS</p><span className="t-selected">↳ Manipulation cell</span><span>Test history</span><span>Configurations</span><span>Investigations</span><div className="t-sidebar-foot"><span aria-hidden="true">◈</span> Every run.<br />Its own record.</div></aside>
          <div className="t-app-main">
            <div className="t-app-title"><div><p>MANIPULATION CELL / RUN COMPARISON</p><h2>A test changed.<br className="t-mobile" /> Here’s the record.</h2></div><Link href="/services/run-comparison/" aria-label="Open the interactive run comparison">Open comparison ↗</Link></div>
            <div className="t-run-cards"><div><span className="t-status t-success">Successful baseline</span><strong>{baseline.id}</strong><p>{baseline.successfulPicks}/{baseline.attemptedPicks} successful picks</p><small>Snapshot revision {baseline.snapshotRevision}</small></div><span className="t-run-arrow" aria-hidden="true">→</span><div><span className="t-status t-failure">Failed test</span><strong>{target.id}</strong><p>{target.successfulPicks}/{target.attemptedPicks} successful picks</p><small>Snapshot revision {target.snapshotRevision}</small></div></div>
            <div className="t-diff-heading"><strong>Recorded differences</strong><span>Before → After</span></div>
            <dl className="t-diff-list">{rows.map(row => <div key={row.key}><dt>{row.label}{row.key === 'hardware' && <small>Manually reported</small>}</dt><dd><span>{formatField(row.before)}</span><span aria-hidden="true">→</span><strong>{formatField(row.after)}</strong></dd></div>)}</dl>
            <div className="t-evidence-note"><span aria-hidden="true">○</span><p>Differences guide an investigation. They don’t prove a cause.<br />Missing evidence stays unknown.</p></div>
          </div>
        </div>
      </div>
      </AnimatedContent>
      <p className="t-preview-caption">An illustrative view of Tav’s comparison workflow, using invented records and unavailable evidence. <Link href="/walkthrough/">See the walkthrough ↗</Link></p>
      <DeveloperTools />
    </section>

    <section className="t-onboarding m-wrap" aria-labelledby="onboarding-title">
      <AnimatedContent distance={65} duration={0.85} animateOpacity={false} data-animated-content><h2 id="onboarding-title">Your team.<br /><span>A direct line to ours.</span></h2><p>We’re planning to work closely with a small group of robotics teams. Start with a demo, talk through your workflow, and decide together whether a pilot fits.</p><Link className="t-secondary" href="/services/pilot/">Explore the proposed four-week pilot ↗</Link></AnimatedContent>
      <ol className="t-onboarding-list" data-reveal><li><span>01</span><div><h3>Meet Tav</h3><p>Walk through a test comparison with the founders.</p></div></li><li><span>02</span><div><h3>Map your workflow</h3><p>Discuss your robots, existing tools, and the records you need.</p></div></li><li><span>03</span><div><h3>Agree on a focused pilot</h3><p>Define scope and readiness together before connecting real records.</p></div></li></ol>
    </section>

    <section className="t-invitation m-wrap"><AnimatedContent distance={65} duration={0.85} animateOpacity={false} data-animated-content><h2>Let’s look at<br /><span>what changed.</span></h2><p>Pricing is tailored to your team after a demo and discussion.</p><a className="t-button" href="/login/?mode=signup">Get started <span aria-hidden="true">↗</span></a><p className="t-caption"><a href={booking.href}>Discuss your team’s workflow with us.</a></p></AnimatedContent></section>
  </MarketingShell>;
}
