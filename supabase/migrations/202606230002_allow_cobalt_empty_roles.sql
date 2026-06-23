alter table public.applicants
  drop constraint if exists applicants_roles_check;

alter table public.applicants
  add constraint applicants_roles_check
  check (cardinality(roles) in (0, 3));
