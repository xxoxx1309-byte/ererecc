do $$
declare
  target_teams jsonb;
  target_captains jsonb;
  member_counts integer[];
  unique_member_count integer;
  captain_count integer;
begin
  select event.teams, event.captains
  into target_teams, target_captains
  from public.events event
  where event.name = '꼬리잡기 내전'
  order by event.updated_at desc
  limit 1;

  select array_agg(jsonb_array_length(team.value -> 'members') order by team.value ->> 'name')
  into member_counts
  from jsonb_array_elements(target_teams) team(value);

  select count(distinct member.value)
  into unique_member_count
  from jsonb_array_elements(target_teams) team(value)
  cross join lateral jsonb_array_elements_text(team.value -> 'members') member(value);

  if member_counts <> array[3, 3, 3, 3, 3, 3, 3, 0] then
    raise exception '잘못된 팀별 인원 수: %', member_counts;
  end if;
  if unique_member_count <> 21 then
    raise exception '중복 또는 누락된 팀원 수: %', unique_member_count;
  end if;
  select count(*) into captain_count from jsonb_object_keys(target_captains);
  if captain_count <> 7 then
    raise exception '잘못된 팀장 수: %', captain_count;
  end if;
end
$$;
