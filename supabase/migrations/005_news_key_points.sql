-- News reader: extractive key points per story, filled by the fetch-news Edge Function
-- (supabase/functions/fetch-news/summarize.ts). No AI service: the points are the article's own sentences.

alter table public.news_articles
  add column key_points text[],                       -- 3-5 most informative sentences from the article body
  add column word_count int,                          -- article length, for "N min read"
  add column details_status text not null default 'pending' check (details_status in ('pending','ok','failed'));
create index news_details_pending_idx on public.news_articles (published_at desc) where details_status = 'pending';

-- get_news returns `setof public.news_articles` with `select *`, so it picks up the new columns as is.
