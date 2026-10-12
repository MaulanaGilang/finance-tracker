-- News tool: articles pulled from RSS by the fetch-news Edge Function (supabase/functions/fetch-news).

create table public.news_articles (
  id bigserial primary key,
  url text not null unique,
  title text not null,
  summary text,
  source text not null,
  image_url text,
  published_at timestamptz not null,
  topics text[] not null default '{}',
  -- how many market-moving terms (inflation, tariffs, oil prices, GDP...) the story mentions
  market_score smallint not null default 0,
  saved boolean not null default false,
  fetched_at timestamptz not null default now()
);
create index news_published_idx on public.news_articles (published_at desc);
create index news_topics_idx on public.news_articles using gin (topics);

alter table public.news_articles enable row level security;
revoke all on public.news_articles from anon, authenticated;

create or replace function public.get_news(p_token text, p_days int default 14)
returns setof public.news_articles language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  return query select * from public.news_articles
  where saved or published_at > now() - make_interval(days => least(greatest(p_days, 1), 60))
  order by published_at desc limit 600;
end $$;

create or replace function public.set_news_saved(p_token text, p_id bigint, p_saved boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  update public.news_articles set saved = p_saved where id = p_id;
end $$;

revoke execute on function public.get_news(text, int), public.set_news_saved(text, bigint, boolean) from public, authenticated;
grant execute on function public.get_news(text, int), public.set_news_saved(text, bigint, boolean) to anon;

-- Fetch every 2 hours (pg_cron + pg_net). The Edge Function throttles itself to once per 10 minutes.
-- select cron.schedule('fetch-news-every-2h', '7 */2 * * *', $$ select net.http_post(
--   url := 'https://<project>.supabase.co/functions/v1/fetch-news',
--   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <anon key>'),
--   body := '{}'::jsonb, timeout_milliseconds := 60000) $$);
