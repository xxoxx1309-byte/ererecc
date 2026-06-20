alter table public.applicants
  add column current_mmr integer not null default 0 check (current_mmr >= 0),
  add column peak_mmr integer not null default 0 check (peak_mmr >= 0),
  add column peak_season_id integer;

update public.applicants
set current_mmr = mmr,
    peak_mmr = mmr,
    peak_season_id = 39;
