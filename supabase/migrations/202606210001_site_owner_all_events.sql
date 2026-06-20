create or replace function public.can_edit_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_site_owner()
    or case
      when event.slug = 'match-20260620-099ffa' then
        public.is_site_operator()
        and lower(coalesce(auth.jwt() ->> 'email', '')) = 'enlilblei@gmail.com'
      else public.can_manage_event(target_event_id)
    end
  from public.events event
  where event.id = target_event_id;
$$;

grant execute on function public.can_edit_event(uuid) to authenticated;
