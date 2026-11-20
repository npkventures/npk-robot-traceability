import Link from 'next/link';
import TavWordmark from './components/tav-wordmark';
import { SiteCardNav } from './components/site-card-nav';
import { readSiteConfig, readDemoBooking } from '../lib/site-config.mjs';
import ProductEntry from './product-entry';
import DemoHelper from './demo-helper';
import MarketingMotion from './marketing-motion';
import './marketing.css';
import './marketing-simple.css';
export const localWorkspace = process.env.NODE_ENV === 'development' && process.env.TAVRIK_UNIFIED_SITE !== 'true';
export function MarketingShell({active,children}:{active:string;children:React.ReactNode}) {
 const config = readSiteConfig();
 const booking = readDemoBooking();
 return <MarketingMotion><a className="skip-link" href="#main">Skip to content</a><SiteCardNav active={active} bookingHref={booking.href} productEntry={process.env.TAVRIK_UNIFIED_SITE === 'true' ? <ProductEntry /> : <><Link className="m-product-link" href="/login/">Sign in</Link><Link className="m-product-link" href="/login/?mode=signup">Get started</Link><Link className="m-product-link" href="/demo/">Explore demo</Link></>} /><main id="main">{children}</main><footer className="m-footer m-wrap"><div className="m-footer-top"><Link className="m-logo" href="/" aria-label="Tav home"><TavWordmark /></Link><p>A clearer record.<br/>A better starting point.</p><div><Link href="/about/#founders">Talk to the founders ↗</Link><Link href="/walkthrough/">Product walkthrough</Link><Link href="/security/">Security &amp; data handling</Link><Link href="/extensions/">Chrome extension</Link><Link href="/compatibility/">Compatibility preview</Link></div></div><div className="m-footer-bottom"><span>© 2026 Tav</span><span>Robot configuration history</span><span>{config.launchReady?'Synthetic examples · No robot connection':'Local preview · Publication pending'}</span></div></footer><DemoHelper href={booking.href} /></MarketingMotion>;
}
export function PageIntro({number,label,title,text}:{number:string;label:string;title:string;text:string}) { return <section className="m-intro m-wrap"><p className="m-kicker">{number} / {label}</p><h1>{title}</h1><p className="m-lead">{text}</p></section>; }
export function EditorialLink({href,number,title,children}:{href:string;number:string;title:string;children:React.ReactNode}) { return <Link href={href} className="m-editorial-link" data-reveal><span className="m-kicker">{number}</span><div><h2>{title}</h2><p>{children}</p></div><span className="m-arrow" aria-hidden="true">↗</span></Link>; }
export function RecordSculpture() { return <div className="m-sculpture" role="img" aria-label="Abstract illustration of configuration layers joining a single robot-test record"><div className="m-orbit"/><div className="m-orbit m-orbit-two"/><div className="m-spine"/>{['HARDWARE','SOFTWARE','CALIBRATION','MODEL + DATA'].map((label,index)=><div key={label} className={`m-slab slab-${index}`}><span>0{index+1}</span><strong>{label}</strong><i/></div>)}<span className="m-art-caption">CONFIGURATION STUDY — ILLUSTRATION</span></div>; }

