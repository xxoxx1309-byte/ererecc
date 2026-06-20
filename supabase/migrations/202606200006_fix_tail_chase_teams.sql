create temporary table target_team_assignment (
  team_no integer not null,
  position integer not null,
  nickname text not null,
  is_captain boolean not null default false
) on commit drop;

insert into target_team_assignment (team_no, position, nickname, is_captain) values
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
  missing_nicknames text[];
  teams_json jsonb;
  captains_json jsonb;
  picked_json jsonb;
begin
  select id into target_event_id
  from public.events
  where name = '꼬리잡기 내전'
  order by updated_at desc
  limit 1;

  select array_agg(assignment.nickname order by assignment.team_no, assignment.position)
  into missing_nicknames
  from target_team_assignment assignment
  where not exists (
    select 1 from public.applicants applicant
    where applicant.event_id = target_event_id
      and lower(applicant.nickname) = lower(assignment.nickname)
  );

  if target_event_id is null then
    raise exception '꼬리잡기 내전을 찾지 못했습니다.';
  end if;
  if missing_nicknames is not null then
    raise exception '등록되지 않은 참가자: %', array_to_string(missing_nicknames, ', ');
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', '00000000-0000-4000-8000-' || lpad(team_no::text, 12, '0'),
    'name', team_no || '팀',
    'members', coalesce((
      select jsonb_agg(applicant.id::text order by assignment.position)
      from target_team_assignment assignment
      join public.applicants applicant
        on applicant.event_id = target_event_id
       and lower(applicant.nickname) = lower(assignment.nickname)
      where assignment.team_no = team_no
    ), '[]'::jsonb)
  ) order by team_no)
  into teams_json
  from generate_series(1, 8) team_no;

  select jsonb_object_agg(
    '00000000-0000-4000-8000-' || lpad(assignment.team_no::text, 12, '0'),
    applicant.id::text
  )
  into captains_json
  from target_team_assignment assignment
  join public.applicants applicant
    on applicant.event_id = target_event_id
   and lower(applicant.nickname) = lower(assignment.nickname)
  where assignment.is_captain;

  select jsonb_agg(applicant.id::text order by assignment.team_no, assignment.position)
  into picked_json
  from target_team_assignment assignment
  join public.applicants applicant
    on applicant.event_id = target_event_id
   and lower(applicant.nickname) = lower(assignment.nickname)
  where not assignment.is_captain;

  update public.events
  set teams = teams_json,
      captains = captains_json,
      draft = jsonb_set(coalesce(draft, '{}'::jsonb), '{picked}', coalesce(picked_json, '[]'::jsonb), true)
  where id = target_event_id;
end
$$;
