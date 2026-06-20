create table public.event_collaborators (
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, email)
);

create unique index event_collaborators_event_email_unique
  on public.event_collaborators (event_id, lower(email));

alter table public.event_collaborators enable row level security;

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
      and (
        exists (
          select 1
          from public.events
          where id = target_event_id
            and owner_id = auth.uid()
        )
        or exists (
          select 1
          from public.event_collaborators
          where event_id = target_event_id
            and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
    );
$$;

with target_event as (
  select id
  from public.events
  where name = '꼬리잡기 내전'
  order by updated_at desc
  limit 1
)
insert into public.event_collaborators (event_id, email)
select id, 'enlilblei@gmail.com'
from target_event
on conflict do nothing;
