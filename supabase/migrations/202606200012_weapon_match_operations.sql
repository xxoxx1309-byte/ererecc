alter table public.events
  add column if not exists room_codes jsonb not null default '[]'::jsonb,
  add column if not exists match_records jsonb not null default '[]'::jsonb;

create table public.event_backups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null,
  snapshot jsonb not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index event_backups_event_created_idx on public.event_backups (event_id, created_at desc);
alter table public.event_backups enable row level security;

create policy "operators read event backups"
on public.event_backups for select to authenticated
using (public.can_manage_event(event_id));

create policy "editors create event backups"
on public.event_backups for insert to authenticated
with check (public.can_edit_event(event_id) and created_by = auth.uid());

create policy "editors delete event backups"
on public.event_backups for delete to authenticated
using (public.can_edit_event(event_id));

grant select, insert, delete on public.event_backups to authenticated;

create table public.public_event_updates (
  event_id uuid primary key references public.events(id) on delete cascade,
  slug text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.public_event_updates enable row level security;
create policy "public reads event update signals"
on public.public_event_updates for select to anon, authenticated
using (true);
grant select on public.public_event_updates to anon, authenticated;

insert into public.public_event_updates (event_id, slug, updated_at)
select id, slug, updated_at from public.events where published
on conflict (event_id) do update set slug = excluded.slug, updated_at = excluded.updated_at;

create or replace function public.sync_public_event_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published then
    insert into public.public_event_updates (event_id, slug, updated_at)
    values (new.id, new.slug, new.updated_at)
    on conflict (event_id) do update set slug = excluded.slug, updated_at = excluded.updated_at;
  else
    delete from public.public_event_updates where event_id = new.id;
  end if;
  return new;
end;
$$;

create trigger events_sync_public_update
after insert or update of updated_at, slug, published on public.events
for each row execute function public.sync_public_event_update();

alter publication supabase_realtime add table public.public_event_updates;

create or replace function public.touch_event_from_applicant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events
  set updated_at = now()
  where id = coalesce(new.event_id, old.event_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists applicants_touch_event on public.applicants;
create trigger applicants_touch_event
after insert or update or delete on public.applicants
for each row execute function public.touch_event_from_applicant();
