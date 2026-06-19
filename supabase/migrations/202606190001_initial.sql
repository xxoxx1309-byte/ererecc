create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name text not null check (char_length(name) between 1 and 60),
  published boolean not null default true,
  registration_open boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  event_info jsonb not null default '{}'::jsonb,
  teams jsonb not null default '[]'::jsonb,
  captains jsonb not null default '{}'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  weapon_assignments jsonb not null default '{}'::jsonb,
  replay_codes jsonb not null default '[]'::jsonb,
  scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applicants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  discord_name text not null default '',
  roles text[] not null check (cardinality(roles) = 3),
  game_user_id text,
  mmr integer not null default 0 check (mmr >= 0),
  rank integer not null default 0 check (rank >= 0),
  total_games integer not null default 0 check (total_games >= 0),
  total_wins integer not null default 0 check (total_wins >= 0),
  most jsonb not null default '[]'::jsonb,
  most_stats jsonb not null default '[]'::jsonb,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index applicants_event_nickname_unique
  on public.applicants (event_id, lower(nickname));
create index applicants_event_created_idx
  on public.applicants (event_id, created_at);
create index events_owner_updated_idx
  on public.events (owner_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger applicants_set_updated_at
before update on public.applicants
for each row execute function public.set_updated_at();

create or replace function public.event_accepts_applications(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events
    where id = target_event_id
      and published
      and registration_open
  );
$$;

create or replace function public.get_public_event(event_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  registration_open boolean,
  settings jsonb,
  event_info jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.name, e.registration_open, e.settings, e.event_info, e.updated_at
  from public.events e
  where e.slug = event_slug
    and e.published
  limit 1;
$$;

alter table public.events enable row level security;
alter table public.applicants enable row level security;

create policy "owners read events"
on public.events for select
to authenticated
using (owner_id = auth.uid());

create policy "owners create events"
on public.events for insert
to authenticated
with check (owner_id = auth.uid());

create policy "owners update events"
on public.events for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "owners delete events"
on public.events for delete
to authenticated
using (owner_id = auth.uid());

create policy "owners read applicants"
on public.applicants for select
to authenticated
using (
  exists (
    select 1 from public.events
    where events.id = applicants.event_id
      and events.owner_id = auth.uid()
  )
);

create policy "public registers for open events"
on public.applicants for insert
to anon, authenticated
with check (public.event_accepts_applications(event_id));

create policy "owners update applicants"
on public.applicants for update
to authenticated
using (
  exists (
    select 1 from public.events
    where events.id = applicants.event_id
      and events.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.events
    where events.id = applicants.event_id
      and events.owner_id = auth.uid()
  )
);

create policy "owners delete applicants"
on public.applicants for delete
to authenticated
using (
  exists (
    select 1 from public.events
    where events.id = applicants.event_id
      and events.owner_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.events to authenticated;
grant insert on public.events to authenticated;
grant update, delete on public.events to authenticated;
grant insert on public.applicants to anon, authenticated;
grant select, update, delete on public.applicants to authenticated;
grant execute on function public.event_accepts_applications(uuid) to anon, authenticated;
grant execute on function public.get_public_event(text) to anon, authenticated;

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.applicants;
