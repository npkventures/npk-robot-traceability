'use client';
import { useEffect, useRef, useState } from 'react';
import { workspaceApi as api, bindAccount, discardRequests, announceAccountChange, accountChannelId } from './workspace-api';
import { productDestination } from '../../lib/product-destination';
import Workspace from '../../app/local/workspace';
import AccountEntry from './account-entry';
import PilotPanel from './pilot-panel';
import HistoryPanel from './history-panel';
import ProjectPanel, { ClientProjects } from './project-panel';
import MachinePanel from './machine-panel';
import LifecyclePanel from './lifecycle-panel';
import IntegrationPanel from './integration-panel';
import type { Bundle } from '../../lib/local/records';

type Membership = { org_id: string; role: string; organizations: { name: string } };
type Loaded = { version: number; bundle: Bundle; role: string; updated_at?: string; incremental?: boolean; historyOnly?: boolean };
export default function Page() {
  const destination = useRef('/app');
  const activeOrg = useRef('');
  const activeRole = useRef('');
  const activeUser = useRef('');
  const requestVersion = useRef(0);
  const [signup, setSignup] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [session, setSession] = useState<{ user: { id: string; email: string }; memberships: Membership[] } | null>(null);
  const [org, setOrg] = useState(''), [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [available, setAvailable] = useState(false), [checked, setChecked] = useState(false);
  const [secret, setSecret] = useState('');
  const [invitation, setInvitation] = useState('');
  const [passwordSetup, setPasswordSetup] = useState(false);
  const [contextRevision, setContextRevision] = useState(0);
  const [githubAvailable,setGithubAvailable]=useState(false);
  const [googleAvailable,setGoogleAvailable]=useState(false);
  const [projectsAvailable,setProjectsAvailable]=useState(false);
  const [machinesAvailable,setMachinesAvailable]=useState(false);
  const [lifecycleAvailable,setLifecycleAvailable]=useState(false);
  const [portalAvailable,setPortalAvailable]=useState(false);
  const [connectorsAvailable,setConnectorsAvailable]=useState(false);
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([]);
  const [access, setAccess] = useState<{ invitations: { id: string; email: string; role: string; revoked_at: string | null; used_at: string | null }[]; credentials: { id: string; robot_id: string; revoked_at: string | null }[] }>({ invitations: [], credentials: [] });
  function clearWorkspace() {
    requestVersion.current++; discardRequests(); activeOrg.current = ''; activeRole.current = '';
    setLoaded(null); setOrg(''); setSecret(''); setMembers([]); setAccess({ invitations: [], credentials: [] });
  }
  async function refreshSession() {
    const s = await api('session'); setError('');
    if (activeUser.current && activeUser.current !== s.user.id) clearWorkspace();
    activeUser.current = s.user.id; bindAccount(s.user.id); setSession(s);
    const requested = new URL(destination.current, location.origin).searchParams.get('org');
    window.history.replaceState(null, '', destination.current);
    const currentMembership = s.memberships.find((m: Membership) => m.org_id === activeOrg.current);
    if (activeOrg.current && (!currentMembership || activeRole.current && currentMembership.role !== activeRole.current)) clearWorkspace();
    if (!activeOrg.current) {
      if (requested && !s.memberships.some((m: Membership) => m.org_id === requested)) {
        setError('You do not have access to the requested team. Choose one of your teams or ask its owner for an invitation.');
      } else {
        const id = requested || (s.memberships.length === 1 ? s.memberships[0].org_id : '');
        if (id) await openOrganization(id, true);
      }
    }
  }
  useEffect(() => {
    const lost = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      clearWorkspace(); setError(detail?.message || 'Access changed. Reopen your team or sign in again.');
      if (detail?.expired) { bindAccount(''); activeUser.current = ''; setSession(null); setPasswordSetup(false); window.history.replaceState(null, '', '/login?next=' + encodeURIComponent(destination.current)); }
    };
    const changed = () => { clearWorkspace(); bindAccount(''); activeUser.current = ''; setSession(null); setPasswordSetup(false); setError('Your account changed in another tab. Sign in or reload to continue.'); };
    const channel = new BroadcastChannel('tavrik-account'); channel.onmessage = event => { if (event.data?.source !== accountChannelId) changed(); };
    window.addEventListener('tavrik-access-lost', lost);
    const restored = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); };
    window.addEventListener('pageshow', restored);
    return () => { channel.close(); window.removeEventListener('tavrik-access-lost', lost); window.removeEventListener('pageshow', restored); discardRequests(); bindAccount(''); };
  }, []);
  useEffect(() => {
    if (!session || passwordSetup) return;
    let checking = false;
    const validate = async () => {
      if (checking || document.hidden) return;
      checking = true; setValidating(true);
      const version = requestVersion.current;
      try { await refreshSession(); } catch { if (version === requestVersion.current) { clearWorkspace(); setError('Could not verify workspace access. Reload or sign in again.'); } }
      finally { checking = false; setValidating(false); }
    };
    const interval = window.setInterval(() => void validate(), 30000);
    window.addEventListener('focus', validate);
    return () => { clearInterval(interval); window.removeEventListener('focus', validate); };
  }, [session?.user.id, passwordSetup]);
  useEffect(() => {
    const receiveInvitation = () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('invitation');
      if (token && /^(ui|up)_[a-f0-9]{64}$/.test(token)) {
        setInvitation(token); try { sessionStorage.setItem('tavrik-invitation', token); } catch {}
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    try { const saved = sessionStorage.getItem('tavrik-invitation'); if (saved && /^(ui|up)_[a-f0-9]{64}$/.test(saved)) setInvitation(saved); } catch {}
    receiveInvitation();
    window.addEventListener('hashchange', receiveInvitation);
    return () => window.removeEventListener('hashchange', receiveInvitation);
  }, []);
  useEffect(() => {
    const query=new URLSearchParams(window.location.search);
    setSignup(query.get('mode') === 'signup');
    const next = query.get('next') || (location.pathname === '/app' && query.has('org') ? location.pathname + location.search : '');
    try { destination.current = productDestination(next || sessionStorage.getItem('tavrik-destination')); sessionStorage.setItem('tavrik-destination', destination.current); } catch { destination.current = productDestination(next); }
    if(query.has('auth_error')){setError('Provider sign-in was cancelled, expired, or needs account approval. Sign in with your existing password and use Account access to approve the provider.');window.history.replaceState(null,'',window.location.pathname);}
    void api('auth-options').then(o=>{setGoogleAvailable(o.google);setGithubAvailable(o.github);setProjectsAvailable(o.projects);setMachinesAvailable(o.machines);setLifecycleAvailable(o.executions);setPortalAvailable(o.portal);setConnectorsAvailable(o.connectors);}).catch(()=>{});
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const pendingInvitation = fragment.get('invitation');
    if (pendingInvitation && /^(ui|up)_[a-f0-9]{64}$/.test(pendingInvitation)) setInvitation(pendingInvitation);
    const access = fragment.get('access_token'), kind = fragment.get('type');
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    let configured = false;
    void api('status').then(async () => {
      configured = true;
      if (fragment.has('error')) throw new Error('This email link is invalid or expired. Request a new confirmation or reset link.');
      if (access) {
        await api('auth-session', { access_token: access });
        if (kind === 'recovery' || kind === 'invite') { const account = await api('session'); activeUser.current = account.user.id; bindAccount(account.user.id); setSession(account); setPasswordSetup(true); }
        else await refreshSession();
      } else await refreshSession().catch(() => {});
    }).catch(e => setError(e.message)).finally(() => { setAvailable(configured); setChecked(true); });
  }, []);
  async function action(work: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); } finally { setBusy(false); } }
  async function openOrganization(id: string, automatic = false, reload = false) {
    if (!reload && id === activeOrg.current && loaded) return;
    if (!automatic && loaded && !window.confirm('Export any unsaved draft before switching or reloading. Continue?')) return;
    // Clear the prior organization immediately; no old rows under a new heading.
    clearWorkspace(); const version = requestVersion.current; activeOrg.current = id; setOrg(id);
    destination.current = productDestination('/app' + (id ? '?org=' + id : ''));
    window.history.replaceState(null, '', destination.current);
    try { sessionStorage.setItem('tavrik-destination', destination.current); } catch {}
    if (!id) return;
    const next = await api(`org/${id}/workspace`);
    if (version !== requestVersion.current) return;
    activeRole.current = next.role; setLoaded(next);
    if (['owner','admin'].includes(next.role)) { const [people, permissions] = await Promise.all([api(`org/${id}/members`), api(`org/${id}/access`)]); if (version !== requestVersion.current) return; setMembers(people); setAccess(permissions); }
  }
  const fields = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); return new FormData(event.currentTarget); };
  return <><div hidden={validating}><header className="beta-bar"><a href="/">Tavrik home</a><strong>Tavrik <span>TEAM WORKSPACE</span></strong>{session && <button disabled={busy} onClick={() => { if (window.confirm('Export or save any draft before signing out. Continue?')) void action(async () => { clearWorkspace(); bindAccount(''); activeUser.current = ''; setSession(null); setPasswordSetup(false); announceAccountChange(); await api('logout', {}); try { sessionStorage.removeItem('tavrik-destination'); sessionStorage.removeItem('tavrik-invitation'); } catch {} setPasswordSetup(false); setInvitation(''); window.history.replaceState(null, '', '/login'); }); }}>Sign out</button>}</header>
    <div className="beta-controls" data-tools={toolsOpen || !!invitation || session?.memberships.length === 0} role={session && !passwordSetup ? 'region' : undefined} aria-label={session && !passwordSetup ? 'Account and organization' : undefined}>
      {invitation && !session && <p role="status">Your team invitation is ready. Sign in with the invited email, or create and verify that account, then accept below. If confirmation opens another tab, reopen your invitation link there.</p>}
      {!session || passwordSetup ? <AccountEntry key={passwordSetup ? 'password' : signup ? 'signup' : 'login'} available={available && !busy} googleAvailable={googleAvailable} githubAvailable={githubAvailable} accountId={activeUser.current} initialMode={passwordSetup ? 'password' : signup ? 'signup' : 'login'} onSignedIn={async () => { bindAccount(''); announceAccountChange(); await refreshSession(); }} onPasswordSaved={() => { clearWorkspace(); bindAccount(''); activeUser.current = ''; announceAccountChange(); setSession(null); setPasswordSetup(false); setMessage('Password saved. Sign in with your new password.'); }} /> : <>
        <h1>Your workspace</h1><p>{session.user.email}</p><nav className="beta-actions" aria-label="Workspace navigation"><button type="button" aria-pressed={!toolsOpen} onClick={() => setToolsOpen(false)}>Robot records</button><button type="button" aria-pressed={toolsOpen} aria-controls="workspace-tools" onClick={() => setToolsOpen(true)}>History and team tools</button></nav><div className="beta-actions"><a href="/demo">Explore demo</a><button disabled={busy} onClick={() => { if (window.confirm('Save or export your draft before changing your password. Continue?')) setPasswordSetup(true); }}>Change password</button></div><label>Organization<select disabled={busy} value={org} onChange={e => void action(() => openOrganization(e.target.value))}><option value="">Choose an organization</option>{session.memberships.map(m => <option key={m.org_id} value={m.org_id}>{m.organizations.name} · {m.role}</option>)}</select></label>
        {org && <div className="beta-actions"><button disabled={busy} onClick={() => void action(() => openOrganization(org, false, true))}>Reload saved records</button><a href={`/api/org/${org}/export`}>Export saved records</a></div>}
        {!session.memberships.length && <p>Your account is ready; team access requires an invitation. Accept your team owner’s invitation below. If you are setting up a new team, contact the founders to arrange onboarding. Creating an account does not activate a subscription. <a href="/contact/">Arrange team onboarding</a></p>}
        {!!session.memberships.length && !org && <p>Choose an organization to load its saved records. Only teams you belong to appear here. Demo selections never become team records.</p>}
        {loaded && <p role="status">Saved version: {loaded.version}. {loaded.version === 0 ? 'No successful save yet.' : loaded.updated_at && Number.isFinite(Date.parse(loaded.updated_at)) ? <>Last successful organization save: <time dateTime={loaded.updated_at}>{new Date(loaded.updated_at).toLocaleString()}</time>.</> : 'Last successful save time unavailable.'} Draft edits are not included until saved.</p>}
        {loaded && !loaded.historyOnly && !loaded.bundle.records.robots.length && <p>{loaded.role === 'viewer' ? 'No saved robots yet. Ask an organization owner or member to add and save records.' : 'This organization has no saved robots. Add a robot below or import approved JSON, then choose Save to organization.'}</p>}
        <details open={invitation ? true : undefined}><summary>Accept an invitation</summary><form onSubmit={e => { const d = fields(e); void action(async () => { await api('accept-invite', { token: d.get('token') }); setInvitation(''); destination.current = '/app'; await refreshSession(); try { sessionStorage.removeItem('tavrik-invitation'); } catch {} setMessage('Invitation accepted. Your team access is ready.'); }); }}><label>Invitation token<input name="token" required autoComplete="off" type="password" value={invitation} onChange={e => setInvitation(e.target.value)} /></label><button disabled={busy}>Accept invitation</button></form></details>
        {(googleAvailable || githubAvailable) && <details><summary>Account access</summary><p>Approve a sign-in provider for this existing account. Save or export your draft first. Use the provider account with the same verified email; this does not grant new organization access.</p><form onSubmit={e=>{const data=fields(e);void action(async()=>{const result=await api(data.get('provider')==='github'?'link-github':'link-google',{password:data.get('password')});window.location.assign(result.url);});}}><label>Current password<input name="password" type="password" autoComplete="current-password" required /></label><label>Provider<select name="provider">{googleAvailable && <option value="google">Google</option>}{githubAvailable && <option value="github">GitHub</option>}</select></label><button disabled={busy}>Approve provider sign-in</button></form></details>}
        {loaded && ['owner','admin'].includes(loaded.role) && <details><summary>Manage team and collector access</summary><p>Organization ID: <code>{org}</code>. Tokens are shown once. Share them securely; Tavrik does not send invitations.</p>
          <form onSubmit={e => { const d = fields(e); void action(async () => { const result = await api(`org/${org}/invite`, { email: d.get('email'), role: d.get('role') }); setSecret(result.token); setAccess(await api(`org/${org}/access`)); }); }}><label>Invite email<input name="email" type="email" required /></label><label>Role<select name="role"><option value="member">Member — add records</option><option value="viewer">Viewer — read and export</option></select></label><button disabled={busy}>Create invitation</button></form>
          <form onSubmit={e => { const d = fields(e); void action(async () => { const result = await api(`org/${org}/credential`, { robot_id: d.get('robot') }); setSecret(result.token); setAccess(await api(`org/${org}/access`)); }); }}><label>Collector robot<select name="robot" required>{loaded.bundle.records.robots.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label><button disabled={busy || !loaded.bundle.records.robots.length}>Create collector credential</button></form>
          {secret && <label>New token — copy now<textarea readOnly value={secret} rows={3} /><button onClick={() => setSecret('')}>Hide token</button></label>}
          {secret.startsWith('ui_') && <label>Invitation link<textarea readOnly rows={3} value={window.location.origin + '/login#invitation=' + secret} /><small>Share privately with the invited person. They must verify the invited email and accept. This link does not send an email.</small></label>}
          <h2>Invitations</h2>{access.invitations.map(i => <p key={i.id}>{i.email} · {i.role} · {i.used_at ? 'Accepted' : i.revoked_at ? 'Revoked' : 'Pending'} <button disabled={busy || !!i.revoked_at || !!i.used_at} onClick={() => void action(async () => { await api(`org/${org}/revoke_invite`, { id: i.id }); setAccess(await api(`org/${org}/access`)); })}>Revoke invitation</button></p>)}
          <h2>Collectors</h2>{access.credentials.map(c => <p key={c.id}>{c.robot_id} · {c.revoked_at ? 'Revoked' : 'Issued'} <button disabled={busy || !!c.revoked_at} onClick={() => void action(async () => { await api(`org/${org}/revoke_credential`, { id: c.id }); setAccess(await api(`org/${org}/access`)); })}>Revoke credential</button></p>)}
          <h2>Members</h2>{members.map(m => <form key={m.user_id} onSubmit={e => { const d = fields(e); if (m.user_id === session.user.id && !window.confirm('Changing your own access closes this workspace. Save or export any draft first. Continue?')) return; void action(async () => { await api(`org/${org}/member`, { user_id: m.user_id, role: d.get('role') }); if (m.user_id === session.user.id) { setLoaded(null); setOrg(''); setSecret(''); await refreshSession(); } else setMembers(await api(`org/${org}/members`)); }); }}><label>{m.user_id}<select name="role" defaultValue={m.role}><option>owner</option><option>admin</option><option>engineer</option><option>operator</option><option>internal_viewer</option><option>member</option><option>viewer</option><option value="remove">Remove access</option></select></label><button disabled={busy}>Update member</button></form>)}
          <details><summary>Delete organization</summary><p>Export first. This deletes all organization records, invitations, credentials and audit history. Provider backups follow the documented retention policy.</p><form onSubmit={e => { const d = fields(e); if (window.confirm('Permanently delete this organization and all its records?')) void action(async () => { await api(`org/${org}/delete_org`, { confirmation: d.get('confirmation') }); setLoaded(null); setOrg(''); setSecret(''); await refreshSession(); setMessage('Organization deleted.'); }); }}><label>Type the organization ID<input name="confirmation" required /></label><button disabled={busy}>Delete organization permanently</button></form></details>
        </details>}
      </>}
      <div id="workspace-tools" hidden={!toolsOpen && !!session?.memberships.length}>
      {loaded?.role === 'owner' && !passwordSetup && <PilotPanel key={org} org={org} api={api} />}
      {machinesAvailable && loaded && ['owner','admin'].includes(loaded.role) && !passwordSetup && <MachinePanel key={org+':'+loaded.role} org={org} api={api}/>}
      {connectorsAvailable && loaded && ['owner','admin'].includes(loaded.role) && !passwordSetup && <IntegrationPanel key={org+':'+loaded.role} org={org} api={api}/>}
      {lifecycleAvailable && loaded && !passwordSetup && <LifecyclePanel key={org+':'+loaded.role} org={org} api={api} canPublish={portalAvailable&&['owner','admin','engineer','member'].includes(loaded.role)}/>}
      {projectsAvailable && session && !passwordSetup && <ClientProjects key={session.user.id} api={api} />}
      {projectsAvailable && loaded && !passwordSetup && !['viewer','internal_viewer'].includes(loaded.role) && <ProjectPanel key={org+':'+loaded.role} org={org} role={loaded.role} api={api} robots={loaded.bundle.records.robots} runs={loaded.bundle.records.runs} />}
      {loaded?.incremental && !passwordSetup && <HistoryPanel key={org} org={org} api={api} open={bundle=>{setLoaded({...loaded,bundle,historyOnly:false});setContextRevision(n=>n+1);}} />}
      {loaded?.historyOnly && <p role="status">Your saved history exceeds the local draft size. Browse it above, or import a bounded batch below. The empty draft does not mean saved records were deleted.</p>}
      </div>
      {checked && !available && <p>The private workspace is unavailable. Ask your administrator to complete staging setup. The public showcase contains synthetic examples and does not display organization records.</p>}
      {busy && <p role="status">Working…</p>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="beta-error">{error}</p>}
    </div>
    {loaded && !passwordSetup && <Workspace key={session?.user.id + ':' + org + ':' + loaded.role + ':' + loaded.version + ':' + contextRevision} hosted={{ initial: loaded.bundle, readOnly: ['viewer','internal_viewer'].includes(loaded.role), runOnly: loaded.role === 'operator', comparison: async (runId, baselineId) => { await api(`org/${org}/pilot-comparison`, { runId, baselineId }); }, save: async (bundle, requestId) => {
      setBusy(true);
      const savingContext = requestVersion.current;
      try {
      // Operators may append runs against existing first revisions; never submit
      // unrelated corrections, mappings or investigations with their run batch.
      if (loaded.role === 'operator') {
        const runs = bundle.records.runs.filter(run => !loaded.bundle.records.runs.some(saved => saved.id === run.id));
        bundle = { format: 'unify-local', version: bundle.version, synthetic: bundle.synthetic, corrections: [], records: {
          runs,
          snapshots: bundle.records.snapshots.filter(snapshot => runs.some(run => run.snapshotId === snapshot.id && run.snapshotRevision === snapshot.revision)),
          robots: bundle.records.robots.filter(robot => runs.some(run => run.robotId === robot.id)),
        } };
      }
      const result = await api(`org/${org}/save`, { bundle, expected_version: loaded.version, request_id: requestId });
      if (savingContext !== requestVersion.current) throw new Error('Workspace changed during save. Reopen the current team.');
      const fresh = await api(`org/${org}/workspace`);
      if (fresh.version < result.version) throw new Error('Could not confirm saved records. Retry with the same draft.');
      setLoaded(fresh);
      } finally { setBusy(false); }
    } }} />}
  </div>{validating && <p role="status" className="beta-controls">Verifying workspace access…</p>}</>;
}

