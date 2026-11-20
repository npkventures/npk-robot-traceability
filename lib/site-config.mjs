export function readDemoBooking(env = process.env) {
  const schedulingUrl = (env.SCHEDULING_URL ?? 'https://cal.com/npk-cnesstkcp/15min').trim();
  if (schedulingUrl) {
    let url;
    try { url = new URL(schedulingUrl); } catch { throw new Error('SCHEDULING_URL must be an HTTPS booking page.'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hostname === 'localhost') throw new Error('SCHEDULING_URL must be an HTTPS booking page without credentials.');
  }
  return { schedulingUrl: schedulingUrl || null, href: schedulingUrl || '/contact/#book-demo' };
}

export function readSiteConfig(env = process.env) {
  const contact = (env.CONTACT_URL || "").trim();
  const site = (env.SITE_URL || "").trim();
  if (contact) {
    let url;
    try { url = new URL(contact); } catch { throw new Error("CONTACT_URL must be a mailto address or HTTPS scheduling URL."); }
    const isEmail = url.protocol === "mailto:" && url.pathname.split(",").every(address => /^[A-Za-z0-9.!#$&'*+/=_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(address)) && !url.search && !url.hash;
    const isHttps = url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
    if (!isEmail && !isHttps) throw new Error("CONTACT_URL must contain valid comma-separated mailto addresses or an HTTPS scheduling URL without credentials.");
  }
  if (site) {
    let url;
    try { url = new URL(site); } catch { throw new Error("SITE_URL must be a public HTTPS origin."); }
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname === "localhost") {
      throw new Error("SITE_URL must be a public HTTPS origin without a path, credentials, query, or fragment.");
    }
  }
  return { contactUrl: contact || null, siteUrl: site ? new URL(site).origin : null, launchReady: Boolean(contact && site) };
}
