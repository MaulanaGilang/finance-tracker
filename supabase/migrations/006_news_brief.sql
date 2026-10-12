-- News article page: a longer extractive read, grouped into paragraphs (supabase/functions/fetch-news/summarize.ts).
-- Still no AI service: every sentence is the article's own.

alter table public.news_articles add column brief text[];

-- Re-summarise recent stories so they get a brief too (the Edge Function works through pending ones each run;
-- opening a story also summarises it on the spot).
update public.news_articles set details_status = 'pending'
where details_status = 'ok' and published_at > now() - interval '7 days';
