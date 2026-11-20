begin;
create table public.approved_github_identities (
 user_id uuid not null references auth.users on delete cascade,
 identity_id uuid primary key references auth.identities(id) on delete cascade,
 approved_at timestamptz not null default now()
);
alter table public.approved_github_identities enable row level security;
revoke all on public.approved_github_identities from public,anon,authenticated;
grant all on public.approved_github_identities to service_role;
create function public.approve_github_session(p_user uuid,p_session uuid,p_identity uuid,p_link boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now())) then raise exception 'forbidden'; end if;
 if not exists(select 1 from auth.identities where id=p_identity and user_id=p_user and provider='github') then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.approved_github_identities where identity_id=p_identity and user_id=p_user) then
  if not p_link and exists(select 1 from auth.identities where user_id=p_user and provider<>'github') then raise exception 'linking_required'; end if;
  insert into public.approved_github_identities(user_id,identity_id) values(p_user,p_identity) on conflict do nothing;
 end if;
 insert into public.approved_app_sessions(session_id,user_id) values(p_session,p_user) on conflict(session_id) do nothing;
 return public.app_session_allowed(p_user,p_session);
end $$;
revoke all on function public.approve_github_session(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.approve_github_session(uuid,uuid,uuid,boolean) to service_role;
commit;
