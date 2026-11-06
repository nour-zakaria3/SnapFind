-- Manual RLS check. Replace the two UUIDs with ids of two real users
-- (Authentication -> Users). Run in the SQL editor as postgres.
-- Expected: both counts at the end are 0 (user B sees nothing of user A).
do $$
declare a uuid := '00000000-0000-0000-0000-00000000000a';
        b uuid := '00000000-0000-0000-0000-00000000000b';
begin
  insert into public.folders (user_id, name) values (a, 'rls-test-folder');
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select count(*) as folders_visible_to_b from public.folders where name = 'rls-test-folder';  -- expect 0
select count(*) as images_visible_to_b  from public.images  where user_id = '00000000-0000-0000-0000-00000000000a'; -- expect 0
reset role;
delete from public.folders where name = 'rls-test-folder';
