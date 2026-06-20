delete from public.site_operators site_operator
where site_operator.is_owner
  and not exists (
    select 1
    from auth.users account
    where account.email is not null
      and encode(extensions.digest(convert_to(lower(account.email), 'UTF8'), 'sha256'), 'hex') = '29581726b0fe79144bf6bd4132e633bfad441fd890a2444b94ff9211ec960fcb'
      and lower(account.email) = lower(site_operator.email)
  );

insert into public.site_operators (email, is_owner)
select lower(account.email), false
from auth.users account
where account.email is not null
  and encode(extensions.digest(convert_to(lower(account.email), 'UTF8'), 'sha256'), 'hex') = '29581726b0fe79144bf6bd4132e633bfad441fd890a2444b94ff9211ec960fcb'
  and not exists (
    select 1
    from public.site_operators site_operator
    where lower(site_operator.email) = lower(account.email)
  );

update public.site_operators site_operator
set is_owner = true
from auth.users account
where account.email is not null
  and encode(extensions.digest(convert_to(lower(account.email), 'UTF8'), 'sha256'), 'hex') = '29581726b0fe79144bf6bd4132e633bfad441fd890a2444b94ff9211ec960fcb'
  and lower(site_operator.email) = lower(account.email);

create unique index if not exists site_operators_single_owner
  on public.site_operators (is_owner)
  where is_owner;
