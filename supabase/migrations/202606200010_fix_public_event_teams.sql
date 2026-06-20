create temporary table public_event_team_assignment (
  team_no integer not null,
  position integer not null,
  nickname text not null,
  is_captain boolean not null default false
) on commit drop;

insert into public_event_team_assignment (team_no, position, nickname, is_captain) values
  (1, 1, 'sirang', true), (1, 2, '쿠즈하', false), (1, 3, '자애', false),
  (2, 1, '차유자', true), (2, 2, '와곰', false), (2, 3, '찹싸르', false),
  (3, 1, '갤리', true), (3, 2, 'Pyuu', false), (3, 3, '전기호랑이', false),
  (4, 1, '수쳐', true), (4, 2, '벤리라', false), (4, 3, '서린불꽃', false),
  (5, 1, '미소녀여고생쟝', true), (5, 2, 'moch', false), (5, 3, 'Fatalist', false),
  (6, 1, '공백', true), (6, 2, '좋은풍경이네', false), (6, 3, '카프카', false),
  (7, 1, '청새치', true), (7, 2, '이등대', false), (7, 3, '연극야', false);

do $$
declare
  target_event_id uuid;
  teams_json jsonb;
  captains_json jsonb;
begin
  select id into target_event_id from public.events where slug = 'match-20260620-099ffa';
  if target_event_id is null then raise exception '대상 내전을 찾지 못했습니다.'; end if;

  with team_members as (
    select assignment.team_no, jsonb_agg(applicant.id::text order by assignment.position) members
    from public_event_team_assignment assignment
    join public.applicants applicant
      on applicant.event_id = target_event_id
     and lower(applicant.nickname) = lower(assignment.nickname)
    group by assignment.team_no
  )
  select jsonb_agg(jsonb_build_object(
    'id', '00000000-0000-4000-8000-' || lpad(team_number.value::text, 12, '0'),
    'name', team_number.value || '팀',
    'members', coalesce(team_members.members, '[]'::jsonb)
  ) order by team_number.value)
  into teams_json
  from generate_series(1, 8) team_number(value)
  left join team_members on team_members.team_no = team_number.value;

  select jsonb_object_agg(
    '00000000-0000-4000-8000-' || lpad(assignment.team_no::text, 12, '0'),
    applicant.id::text
  )
  into captains_json
  from public_event_team_assignment assignment
  join public.applicants applicant
    on applicant.event_id = target_event_id
   and lower(applicant.nickname) = lower(assignment.nickname)
  where assignment.is_captain;

  if (select count(distinct member.value)
      from jsonb_array_elements(teams_json) team(value)
      cross join lateral jsonb_array_elements_text(team.value -> 'members') member(value)) <> 21 then
    raise exception '팀원 누락 또는 중복';
  end if;

  update public.events set teams = teams_json, captains = captains_json where id = target_event_id;
end
$$;
