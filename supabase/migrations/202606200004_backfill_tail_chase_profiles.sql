with profile_values (nickname, user_id, mmr, rank, total_games, total_wins, most, most_stats) as (
  values
    ('sirang', 'yJTK4f2qcEYocb6aJ6pn6Zcw9quu8pK1eHg9M0Nv58duTIpmR99g-So', 6465, 10489, 123, 21,
      '["히스이","데비&마를렌","다르코"]'::jsonb,
      '[{"characterCode":78,"name":"히스이","totalGames":34,"wins":5},{"characterCode":65,"name":"데비&마를렌","totalGames":32,"wins":2},{"characterCode":74,"name":"다르코","totalGames":27,"wins":4}]'::jsonb),
    ('청새치', '4HRcF5IsYyWY-PUk37oUnv8aHwfLjmPthlktM2TA4mtHF6NpeUhexTuBnR4', 7703, 3234, 227, 31,
      '["비형","데비&마를렌","바냐"]'::jsonb,
      '[{"characterCode":88,"name":"비형","totalGames":100,"wins":19},{"characterCode":65,"name":"데비&마를렌","totalGames":65,"wins":5},{"characterCode":64,"name":"바냐","totalGames":9,"wins":2}]'::jsonb),
    ('벤리라', 'AFV3e5LgvGImfjsdqIrAhhjCLB3yfAY1HROSVMSeN7BXQIO87UcY2nE5Ckij', 6145, 13193, 164, 25,
      '["카티야","프리야","일레븐"]'::jsonb,
      '[{"characterCode":72,"name":"카티야","totalGames":93,"wins":14},{"characterCode":51,"name":"프리야","totalGames":27,"wins":5},{"characterCode":30,"name":"일레븐","totalGames":14,"wins":3}]'::jsonb),
    ('나래', '7tZTu3AdH52aXHueljzrei8o5Y6ZxvKpyzUMrqWaT7viMaX0ZC1kpvUd', 0, 0, 0, 0, '[]'::jsonb, '[]'::jsonb),
    ('Fatalist', '9zldbCcLAfSM2r0EFY8j6Hm0hHsfRffXrJV3wi-qn3IW2xFBkcy_-CKehFE', 4379, 48067, 32, 9,
      '["피올로","캐시","가넷"]'::jsonb,
      '[{"characterCode":56,"name":"피올로","totalGames":30,"wins":9},{"characterCode":23,"name":"캐시","totalGames":1,"wins":0},{"characterCode":76,"name":"가넷","totalGames":1,"wins":0}]'::jsonb),
    ('차유자', 'dQNv2gtaqmOVImE7ZzdgFXjfCiqq8G92jbCYEGmWRVvTKg70nD7JGBnodWc', 7655, 3581, 156, 30,
      '["유민","헨리","아비게일"]'::jsonb,
      '[{"characterCode":77,"name":"유민","totalGames":69,"wins":18},{"characterCode":83,"name":"헨리","totalGames":17,"wins":3},{"characterCode":67,"name":"아비게일","totalGames":17,"wins":3}]'::jsonb),
    ('갤리', 'l_xeHHqUQ2s-e53NJpP9j7Lrz6yPVooYd4lz_rfV8gOIzCN2oWQhjUA', 5350, 0, 0, 0, '[]'::jsonb, '[]'::jsonb),
    ('와곰', 'oaxkdesVgl2xzvDZFH3RwIgVR-33FatTMKDkOr-lxllUPCC4Cnzcqao', 5847, 16799, 63, 20,
      '["레니","수아","일레븐"]'::jsonb,
      '[{"characterCode":69,"name":"레니","totalGames":22,"wins":6},{"characterCode":28,"name":"수아","totalGames":18,"wins":6},{"characterCode":30,"name":"일레븐","totalGames":7,"wins":4}]'::jsonb)
)
update public.applicants applicant
set
  game_user_id = profile_values.user_id,
  mmr = profile_values.mmr,
  rank = profile_values.rank,
  total_games = profile_values.total_games,
  total_wins = profile_values.total_wins,
  most = profile_values.most,
  most_stats = profile_values.most_stats
from profile_values
where lower(applicant.nickname) = lower(profile_values.nickname)
  and exists (
    select 1
    from public.events event
    where event.id = applicant.event_id
      and event.name = '꼬리잡기 내전'
  );
