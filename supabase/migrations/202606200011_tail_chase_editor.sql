create or replace function public.can_edit_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when event.slug = 'match-20260620-099ffa' then
      public.is_site_operator()
      and lower(coalesce(auth.jwt() ->> 'email', '')) = 'enlilblei@gmail.com'
    else public.can_manage_event(target_event_id)
  end
  from public.events event
  where event.id = target_event_id;
$$;

drop policy "operators update events" on public.events;
create policy "operators update events"
on public.events for update
to authenticated
using (public.can_edit_event(id))
with check (public.can_edit_event(id));

drop policy "operators update applicants" on public.applicants;
create policy "operators update applicants"
on public.applicants for update
to authenticated
using (public.can_edit_event(event_id))
with check (public.can_edit_event(event_id));

drop policy "operators delete applicants" on public.applicants;
create policy "operators delete applicants"
on public.applicants for delete
to authenticated
using (public.can_edit_event(event_id));

grant execute on function public.can_edit_event(uuid) to authenticated;
