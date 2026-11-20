-- Repair listing without changing candidate/review history or activating predictions.
-- Avoid SQL aliases c/r: those names are PL/pgSQL record variables in this function.
begin;
create or replace function public.prediction_command(p_org uuid,p_actor uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare action text:=p_data->>'action';c public.prediction_candidates;r public.prediction_reviews;
 d jsonb:=p_data->'dataset';e jsonb:=p_data->'evaluation';v jsonb;state text;pid uuid;result jsonb;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not found or not public.org_capability(p_org,p_actor,'read_internal') then raise exception 'forbidden';end if;
 if action='list' then
  select coalesce(jsonb_agg(x),'[]') into result from (
   select candidate.id,candidate.project_id,candidate.dataset_hash,candidate.capability,candidate.created_at,
    latest.revision,latest.state,latest.reason,latest.published
   from public.prediction_candidates candidate
   join lateral(
    select review.* from public.prediction_reviews review
    where review.org_id=candidate.org_id and review.candidate_id=candidate.id
    order by review.revision desc limit 1
   )latest on true
   where candidate.org_id=p_org and candidate.project_id=(p_data->>'project_id')::uuid
   order by candidate.created_at desc,candidate.id limit 100
  )x;return result;
 end if;
 if not public.org_capability(p_org,p_actor,'publish') then raise exception 'forbidden';end if;
 if action='register' then
  pid:=(d->>'project_id')::uuid;
  if (d->>'org_id')::uuid<>p_org or not exists(select 1 from public.projects where org_id=p_org and id=pid)
   or d->'cohort'->>'reality' not in ('real','simulation') or e->>'available'<>'false'
   or e->>'dataset_hash'<>d->>'dataset_hash' or jsonb_array_length(d->'rows')>1000 then raise exception 'invalid_candidate';end if;
  for v in select value from jsonb_array_elements(d->'rows') loop
   if not exists(select 1 from public.execution_attempts a where a.org_id=p_org and a.project_id=pid and a.id=(v->>'attempt_id')::uuid
    and a.job_id=(v->>'job_id')::uuid and a.robot_id=v->>'robot_id' and a.snapshot_id=v->'snapshot'->>'id'
    and a.snapshot_revision=(v->'snapshot'->>'revision')::integer and a.payload->>'reality'=d->'cohort'->>'reality') then raise exception 'candidate_source_mismatch';end if;
  end loop;
  select * into c from public.prediction_candidates where org_id=p_org and project_id=pid and dataset_hash=d->>'dataset_hash';
  if c.id is not null then
   if c.dataset<>d or c.evaluation<>e then raise exception 'record_conflict';end if;
   return jsonb_build_object('id',c.id,'duplicate',true);
  end if;
  if (select count(*) from public.prediction_candidates where org_id=p_org)>=1000 then raise exception 'candidate_limit';end if;
  state:=e->>'state';
  if state not in ('collecting_data','insufficient_labels','evaluating') then raise exception 'invalid_candidate';end if;
  insert into public.prediction_candidates values(p_org,pid,(p_data->>'id')::uuid,d->>'dataset_hash',d->'target'->>'capability',d,e,p_actor,clock_timestamp()) returning * into c;
  insert into public.prediction_reviews(org_id,candidate_id,revision,state,reason,author) values(p_org,c.id,1,state,p_data->>'reason',p_actor);
  return jsonb_build_object('id',c.id,'revision',1,'available',false,'duplicate',false);
 elsif action='review' then
  select * into c from public.prediction_candidates where org_id=p_org and id=(p_data->>'id')::uuid;
  if c.id is null then raise exception 'forbidden';end if;
  select * into r from public.prediction_reviews where org_id=p_org and candidate_id=c.id order by revision desc limit 1;
  if r.revision<>(p_data->>'expected_revision')::integer then raise exception 'version_conflict';end if;
  state:=p_data->>'state';
  if state not in ('paused','degraded') and state<>c.evaluation->>'state' then raise exception 'invalid_candidate_state';end if;
  if r.revision>=1000 then raise exception 'candidate_limit';end if;
  insert into public.prediction_reviews values(p_org,c.id,r.revision+1,state,p_data->>'reason',(p_data->>'published')::boolean,p_data->>'public_label',p_data->>'public_reason',p_actor,clock_timestamp());
  return jsonb_build_object('id',c.id,'revision',r.revision+1,'available',false);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.prediction_command(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prediction_command(uuid,uuid,jsonb) to service_role;
commit;
