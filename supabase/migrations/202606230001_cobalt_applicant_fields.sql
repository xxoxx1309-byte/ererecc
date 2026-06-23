alter table public.applicants
  add column if not exists cobalt_rating integer not null default 0,
  add column if not exists cobalt_position text not null default '',
  add column if not exists cobalt_picks text not null default '';

drop function if exists public.get_public_event(text);

create function public.get_public_event(event_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  registration_open boolean,
  settings jsonb,
  event_info jsonb,
  teams jsonb,
  captains jsonb,
  public_applicants jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    event.slug,
    event.name,
    event.registration_open,
    event.settings,
    event.event_info,
    event.teams,
    event.captains,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', applicant.id,
        'nickname', applicant.nickname,
        'roles', applicant.roles,
        'mmr', applicant.mmr,
        'current_mmr', applicant.current_mmr,
        'peak_mmr', applicant.peak_mmr,
        'peak_season_id', applicant.peak_season_id,
        'rank', applicant.rank,
        'total_games', applicant.total_games,
        'total_wins', applicant.total_wins,
        'most', applicant.most,
        'most_stats', applicant.most_stats,
        'cobalt_rating', applicant.cobalt_rating,
        'cobalt_position', applicant.cobalt_position,
        'cobalt_picks', applicant.cobalt_picks
      ) order by applicant.created_at)
      from public.applicants applicant
      where applicant.event_id = event.id
    ), '[]'::jsonb),
    event.updated_at
  from public.events event
  where event.slug = event_slug
    and event.published
  limit 1;
$$;

grant execute on function public.get_public_event(text) to anon, authenticated;
