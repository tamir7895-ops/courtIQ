create or replace function handle_new_user()
returns trigger language plpgsql security definer as $func$
declare
  v_id uuid;
  v_first text;
  v_last text;
begin
  v_id    := NEW.id;
  v_first := coalesce(NEW.raw_user_meta_data->>'first_name', '');
  v_last  := coalesce(NEW.raw_user_meta_data->>'last_name', '');

  insert into profiles (id, first_name, last_name)
  values (v_id, v_first, v_last)
  on conflict (id) do nothing;

  return NEW;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
