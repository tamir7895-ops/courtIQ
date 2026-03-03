create or replace function handle_new_user()
returns trigger language plpgsql security definer as $func$
begin
  insert into profiles (id, first_name, last_name)
  select id,
    coalesce(raw_user_meta_data->>'first_name', ''),
    coalesce(raw_user_meta_data->>'last_name', '')
  from (select (NEW).*) as u
  on conflict (id) do nothing;
  return NEW;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
