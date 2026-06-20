with mmr_values (nickname, mmr, rank, total_games) as (
  values
    ('sirang', 6465, 10484, 123),
    ('청새치', 7703, 3234, 227),
    ('벤리라', 6145, 13189, 164),
    ('나래', 0, 0, 0),
    ('Fatalist', 4379, 48064, 32),
    ('차유자', 7655, 3581, 156),
    ('갤리', 5350, 0, 0),
    ('와곰', 5847, 16800, 63)
)
update public.applicants applicant
set
  mmr = mmr_values.mmr,
  rank = mmr_values.rank,
  total_games = mmr_values.total_games
from mmr_values
where lower(applicant.nickname) = lower(mmr_values.nickname)
  and exists (
    select 1
    from public.events event
    where event.id = applicant.event_id
      and event.name = '꼬리잡기 내전'
  );
