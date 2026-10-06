-- Applied to Supabase project jjflnjfterzpgmhocqxc (budget-tracker, ap-southeast-1).
-- Tables live in public but are unreachable directly: RLS on, no policies, grants revoked.
-- The browser can only call the PIN-gated functions at the bottom of this file.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income','expense')),
  color text not null default '#6B716C',
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index transactions_date_idx on public.transactions (date desc);
create index transactions_category_idx on public.transactions (category_id);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
revoke all on public.categories, public.transactions from anon, authenticated;

insert into public.categories (name, type, color) values
  ('Salary','income','#2F7A55'),
  ('Freelance','income','#4E9470'),
  ('Other income','income','#8DB59E'),
  ('Food','expense','#1F4D3A'),
  ('Transport','expense','#3F6E5A'),
  ('Bills','expense','#6B8F7D'),
  ('Shopping','expense','#A3B8AC'),
  ('Entertainment','expense','#B5483B'),
  ('Health','expense','#C9846F'),
  ('Other','expense','#B9BDB7');

-- ---------------------------------------------------------------------------
-- PIN + sessions (private schema, not exposed over the API)

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (
  id boolean primary key default true check (id),
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table private.sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days'
);

create table private.login_attempts (
  id bigserial primary key,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

create or replace function private.require_session(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or not exists (
    select 1 from private.sessions
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and expires_at > now()
  ) then
    raise exception 'invalid_session' using errcode = '28000';
  end if;
end $$;

create or replace function private.new_session()
returns text language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into private.sessions (token_hash) values (encode(extensions.digest(t, 'sha256'), 'hex'));
  return t;
end $$;

-- ---------------------------------------------------------------------------
-- Public API (called from the browser with the publishable key)

create or replace function public.pin_is_set()
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from private.settings);
$$;

-- First run only: create the PIN and return a session token.
create or replace function public.setup_pin(p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.settings) then
    raise exception 'pin_already_set';
  end if;
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'pin_must_be_6_digits';
  end if;
  insert into private.settings (pin_hash) values (extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));
  return private.new_session();
end $$;

-- Returns a session token, or null on a wrong PIN. Locks for 15 min after 5 failures.
create or replace function public.login(p_pin text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_fails int;
begin
  select count(*) into v_fails from private.login_attempts
  where success = false and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    raise exception 'too_many_attempts';
  end if;

  select pin_hash into v_hash from private.settings;
  if v_hash is null then
    raise exception 'pin_not_set';
  end if;

  if extensions.crypt(p_pin, v_hash) = v_hash then
    insert into private.login_attempts (success) values (true);
    delete from private.sessions where expires_at < now();
    return private.new_session();
  else
    insert into private.login_attempts (success) values (false);
    return null;
  end if;
end $$;

create or replace function public.logout(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from private.sessions where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.change_pin(p_token text, p_old text, p_new text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  perform private.require_session(p_token);
  select pin_hash into v_hash from private.settings;
  if extensions.crypt(p_old, v_hash) <> v_hash then raise exception 'wrong_pin'; end if;
  if p_new !~ '^[0-9]{6}$' then raise exception 'pin_must_be_6_digits'; end if;
  update private.settings set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10));
end $$;

create or replace function public.get_categories(p_token text)
returns setof public.categories language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  return query select * from public.categories order by type, created_at;
end $$;

create or replace function public.save_category(p_token text, p_id uuid, p_name text, p_type text, p_color text)
returns public.categories language plpgsql security definer set search_path = '' as $$
declare r public.categories;
begin
  perform private.require_session(p_token);
  if p_id is null then
    insert into public.categories (name, type, color) values (p_name, p_type, p_color) returning * into r;
  else
    update public.categories set name = p_name, type = p_type, color = p_color where id = p_id returning * into r;
  end if;
  return r;
end $$;

create or replace function public.delete_category(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  delete from public.categories where id = p_id;
end $$;

create or replace function public.get_transactions(p_token text)
returns setof public.transactions language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  return query select * from public.transactions order by date desc, created_at desc;
end $$;

create or replace function public.save_transaction(
  p_token text, p_id uuid, p_type text, p_amount numeric, p_category_id uuid, p_date date, p_note text)
returns public.transactions language plpgsql security definer set search_path = '' as $$
declare r public.transactions;
begin
  perform private.require_session(p_token);
  if p_id is null then
    insert into public.transactions (type, amount, category_id, date, note)
    values (p_type, p_amount, p_category_id, p_date, nullif(trim(p_note), '')) returning * into r;
  else
    update public.transactions
    set type = p_type, amount = p_amount, category_id = p_category_id, date = p_date, note = nullif(trim(p_note), '')
    where id = p_id returning * into r;
  end if;
  return r;
end $$;

create or replace function public.delete_transaction(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_session(p_token);
  delete from public.transactions where id = p_id;
end $$;

-- Only the API functions are callable, and only by the anon (publishable key) role.
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.pin_is_set(), public.setup_pin(text), public.login(text), public.logout(text),
  public.change_pin(text,text,text), public.get_categories(text), public.save_category(text,uuid,text,text,text),
  public.delete_category(text,uuid), public.get_transactions(text),
  public.save_transaction(text,uuid,text,numeric,uuid,date,text), public.delete_transaction(text,uuid)
  from public, authenticated;
grant execute on function public.pin_is_set(), public.setup_pin(text), public.login(text), public.logout(text),
  public.change_pin(text,text,text), public.get_categories(text), public.save_category(text,uuid,text,text,text),
  public.delete_category(text,uuid), public.get_transactions(text),
  public.save_transaction(text,uuid,text,numeric,uuid,date,text), public.delete_transaction(text,uuid)
  to anon;
