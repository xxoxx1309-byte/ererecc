create table public.site_operators (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index site_operators_email_unique
  on public.site_operators (lower(email));

insert into public.site_operators (email, is_owner)
select lower(email), true
from auth.users
where email is not null
order by created_at
limit 1
on conflict do nothing;

alter table public.site_operators enable row level security;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_operators
    where is_owner
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.is_site_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_operators
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_site_owner()
    or (
      public.is_site_operator()
      and exists (
        select 1
        from public.events
        where id = target_event_id
          and owner_id = auth.uid()
      )
    );
$$;

drop policy "owners read events" on public.events;
drop policy "owners create events" on public.events;
drop policy "owners update events" on public.events;
drop policy "owners delete events" on public.events;
drop policy "owners read applicants" on public.applicants;
drop policy "owners update applicants" on public.applicants;
drop policy "owners delete applicants" on public.applicants;

create policy "operators read events"
on public.events for select
to authenticated
using (public.can_manage_event(id));

create policy "operators create events"
on public.events for insert
to authenticated
with check (owner_id = auth.uid() and public.is_site_operator());

create policy "operators update events"
on public.events for update
to authenticated
using (public.can_manage_event(id))
with check (public.can_manage_event(id));

create policy "operators delete events"
on public.events for delete
to authenticated
using (public.can_manage_event(id));

create policy "operators read applicants"
on public.applicants for select
to authenticated
using (public.can_manage_event(event_id));

create policy "operators update applicants"
on public.applicants for update
to authenticated
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

create policy "operators delete applicants"
on public.applicants for delete
to authenticated
using (public.can_manage_event(event_id));

create policy "operators read own profile"
on public.site_operators for select
to authenticated
using (
  public.is_site_owner()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "owner adds operators"
on public.site_operators for insert
to authenticated
with check (public.is_site_owner() and not is_owner);

create policy "owner removes operators"
on public.site_operators for delete
to authenticated
using (public.is_site_owner() and not is_owner);

grant select, insert, delete on public.site_operators to authenticated;
grant execute on function public.is_site_owner() to authenticated;
grant execute on function public.is_site_operator() to authenticated;
grant execute on function public.can_manage_event(uuid) to authenticated;
