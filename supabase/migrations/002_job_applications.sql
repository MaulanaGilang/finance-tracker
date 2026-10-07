-- Job application tracker. Same access model as 001: RLS on, no policies, PIN-gated RPCs only.

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  position text not null,
  company text not null,
  location text,
  category text not null default 'full_time' check (category in ('contract','full_time','part_time')),
  flexibility text not null default 'onsite' check (flexibility in ('onsite','remote','hybrid')),
  status text not null default 'applied' check (status in ('applied','hr_interview','user_interview','test','other','medical_checkup','rejected','ghosted')),
  platform text,
  link text,
  salary_min numeric(14,0),
  salary_max numeric(14,0),
  applied_date date not null default current_date,
  -- Clock for the 2-week ghost rule: reset whenever the status changes
  status_changed_at timestamptz not null default now(),
  -- True when the ghost rule set the status (not you)
  auto_ghosted boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_applications_applied_idx on public.job_applications (applied_date desc);

alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon, authenticated;

-- Applications still waiting on the company (no status change for 14+ days) become ghosted.
-- Runs lazily every time the jobs list is fetched, so no scheduler is needed.
create or replace function private.apply_ghost_rule()
returns void language sql security definer set search_path = '' as $$
  update public.job_applications
  set status = 'ghosted', auto_ghosted = true, status_changed_at = now(), updated_at = now()
  where status not in ('rejected', 'ghosted')
    and status_changed_at < now() - interval '14 days';
$$;

create or replace function public.get_jobs(p_token text)
returns setof public.job_applications language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  perform private.apply_ghost_rule();
  return query select * from public.job_applications order by applied_date desc, created_at desc;
end $$;

-- p_job: { id?, position, company, location, category, flexibility, status, platform, link,
--          salary_min, salary_max, applied_date, notes }
create or replace function public.save_job(p_token text, p_job jsonb)
returns public.job_applications language plpgsql security definer set search_path = '' as $$
declare
  r public.job_applications;
  v_id uuid := nullif(p_job->>'id', '')::uuid;
  v_old_status text;
begin
  perform private.require_session(p_token);
  if v_id is null then
    insert into public.job_applications (position, company, location, category, flexibility, status, platform, link,
      salary_min, salary_max, applied_date, status_changed_at, notes)
    values (p_job->>'position', p_job->>'company', nullif(p_job->>'location',''), p_job->>'category', p_job->>'flexibility',
      coalesce(nullif(p_job->>'status',''), 'applied'), nullif(p_job->>'platform',''), nullif(p_job->>'link',''),
      nullif(p_job->>'salary_min','')::numeric, nullif(p_job->>'salary_max','')::numeric,
      coalesce(nullif(p_job->>'applied_date','')::date, current_date),
      -- a new application's clock starts on the day you applied
      coalesce(nullif(p_job->>'applied_date','')::date, current_date)::timestamptz,
      nullif(trim(p_job->>'notes'), ''))
    returning * into r;
  else
    select status into v_old_status from public.job_applications where id = v_id;
    update public.job_applications set
      position = p_job->>'position', company = p_job->>'company', location = nullif(p_job->>'location',''),
      category = p_job->>'category', flexibility = p_job->>'flexibility', status = p_job->>'status',
      platform = nullif(p_job->>'platform',''), link = nullif(p_job->>'link',''),
      salary_min = nullif(p_job->>'salary_min','')::numeric, salary_max = nullif(p_job->>'salary_max','')::numeric,
      applied_date = (p_job->>'applied_date')::date, notes = nullif(trim(p_job->>'notes'), ''),
      -- changing the status by hand restarts the 2-week clock and clears the auto flag
      status_changed_at = case when p_job->>'status' is distinct from v_old_status then now() else status_changed_at end,
      auto_ghosted = case when p_job->>'status' is distinct from v_old_status then false else auto_ghosted end,
      updated_at = now()
    where id = v_id returning * into r;
  end if;
  return r;
end $$;

create or replace function public.delete_job(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  delete from public.job_applications where id = p_id;
end $$;

revoke execute on function private.apply_ghost_rule() from public, anon, authenticated;
revoke execute on function public.get_jobs(text), public.save_job(text, jsonb), public.delete_job(text, uuid) from public, authenticated;
grant execute on function public.get_jobs(text), public.save_job(text, jsonb), public.delete_job(text, uuid) to anon;

-- ---------------------------------------------------------------------------
-- 2026-10-07: offer/accepted statuses + furthest stage reached (for the funnel)

alter table public.job_applications drop constraint job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check
  check (status in ('applied','hr_interview','user_interview','test','other','medical_checkup','offer','accepted','rejected','ghosted'));

alter table public.job_applications add column max_stage smallint not null default 0;

create or replace function private.stage_rank(p_status text)
returns smallint language sql immutable set search_path = '' as $$
  select case p_status
    when 'hr_interview' then 1 when 'test' then 2 when 'user_interview' then 3
    when 'medical_checkup' then 4 when 'offer' then 5 when 'accepted' then 6
    else 0 end::smallint;
$$;
revoke execute on function private.stage_rank(text) from public, anon, authenticated;

-- Offers and accepted jobs are waiting on you, not the company: never auto-ghost them.
create or replace function private.apply_ghost_rule()
returns void language sql security definer set search_path = '' as $$
  update public.job_applications
  set status = 'ghosted', auto_ghosted = true, status_changed_at = now(), updated_at = now()
  where status not in ('rejected', 'ghosted', 'offer', 'accepted')
    and status_changed_at < now() - interval '14 days';
$$;

-- save_job: same as above, plus max_stage = greatest(max_stage, stage_rank(new status)).
-- (Full definition applied in project; see Supabase migration "job_offer_accepted_and_max_stage".)
