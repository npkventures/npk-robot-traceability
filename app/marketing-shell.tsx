import Link from 'next/link';
import { readSiteConfig } from '../lib/site-config.mjs';
import MarketingMotion from './marketing-motion';
import './marketing.css';
const links = [['Home','/'],['Services','/services/'],['Sectors','/sectors/'],['About','/about/'],['Chrome extension','/extensions/']];
export const localWorkspace = process.env.NODE_ENV === 'development';
function TavWordmark() {
 return <span className="m-brand" aria-hidden="true">
  <svg className="m-monogram" viewBox="0 0 48 48" fill="none" focusable="false">
   <g stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="bevel">
    <path d="M6 7 H42 M24 7 V40" />
    <path d="M6 7 L24 41 L42 7" />
    <path d="M12 34 L24 11 L36 34 M17 25 H31" />
   </g>
  </svg>
  <svg className="m-wordmark" viewBox="0 0 114 62" fill="none" focusable="false">
   <g stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 7 H30 M18 7 V55" />
    <path d="M44 55 V15 L52 7 H60 L68 15 V55 M44 35 H68" />
    <path d="M82 7 V37 L94 55 L106 37 V7" />
   </g>
  </svg>
 </span>;
}
export function MarketingShell({active,children}:{active:string;children:React.ReactNode}) {
 const config = readSiteConfig();
 return <MarketingMotion><a className="skip-link" href="#main">Skip to content</a><header className="m-header m-wrap"><Link className="m-logo" href="/" aria-label="Tav home"><TavWordmark /></Link><nav aria-label="Main navigation">{links.map(([name,href]) => <Link key={href} href={href} aria-current={active===name?'page':undefined}>{name}</Link>)}</nav><Link className="m-product-link" href={localWorkspace?'/workspace/':'/demo/'}>{localWorkspace?'Workspace':'Working demo'} <span aria-hidden="true">↗</span></Link></header><main id="main">{children}</main><footer className="m-footer m-wrap"><div className="m-footer-top"><Link className="m-logo" href="/" aria-label="Tav home"><TavWordmark /></Link><p>A clearer record.<br/>A better starting point.</p><div><Link href="/about/#founders">Talk to the founders ↗</Link><Link href="/walkthrough/">Product walkthrough</Link><Link href="/security/">Security &amp; data handling</Link><Link href="/compatibility/">Compatibility preview</Link></div></div><div className="m-footer-bottom"><span>© 2026 Tav</span><span>Robot configuration history</span><span>{config.launchReady?'Synthetic examples · No robot connection':'Local preview · Publication pending'}</span></div></footer></MarketingMotion>;
}
export function PageIntro({number,label,title,text}:{number:string;label:string;title:string;text:string}) { return <section className="m-intro m-wrap"><p className="m-kicker">{number} / {label}</p><h1>{title}</h1><p className="m-lead">{text}</p></section>; }
export function EditorialLink({href,number,title,children}:{href:string;number:string;title:string;children:React.ReactNode}) { return <Link href={href} className="m-editorial-link" data-reveal><span className="m-kicker">{number}</span><div><h2>{title}</h2><p>{children}</p></div><span className="m-arrow" aria-hidden="true">↗</span></Link>; }
export function RecordSculpture() { return <div className="m-sculpture" role="img" aria-label="Abstract illustration of configuration layers joining a single robot-test record"><div className="m-orbit"/><div className="m-orbit m-orbit-two"/><div className="m-spine"/>{['HARDWARE','SOFTWARE','CALIBRATION','MODEL + DATA'].map((label,index)=><div key={label} className={`m-slab slab-${index}`}><span>0{index+1}</span><strong>{label}</strong><i/></div>)}<span className="m-art-caption">CONFIGURATION STUDY — ILLUSTRATION</span></div>; }

