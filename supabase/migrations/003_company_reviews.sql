-- Company reviews for the job tracker. Researched manually (web search over Glassdoor,
-- JobStreet, Indeed, Jobplanet, etc.) and stored here; the app only reads them.
-- Matched to applications by normalised company name (see normalizeCompany in src/lib/jobs.ts).

create table public.company_reviews (
  company_key text primary key,          -- normalised name, e.g. 'kalbe farma'
  aliases text[] not null default '{}',  -- other names in the tracker that mean the same company
  display_name text not null,
  rating numeric(2,1),                   -- headline rating, null when none found
  rating_source text,
  review_count int,
  recommend_pct int,
  pros text[] not null default '{}',
  cons text[] not null default '{}',
  notes text,                            -- caveats: sample size, group-level data, etc.
  sources jsonb not null default '[]',   -- [{ "label": "...", "url": "..." }]
  researched_at date not null default current_date
);
alter table public.company_reviews enable row level security;
revoke all on public.company_reviews from anon, authenticated;

create or replace function public.get_company_reviews(p_token text)
returns setof public.company_reviews language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  return query select * from public.company_reviews order by display_name;
end $$;
revoke execute on function public.get_company_reviews(text) from public, authenticated;
grant execute on function public.get_company_reviews(text) to anon;
