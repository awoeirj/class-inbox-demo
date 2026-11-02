-- Add variable-length invitation aliases without replacing existing classroom IDs.
create or replace function inbox_private.header_hash(header_name text) returns text
language sql stable security invoker set search_path = '' as $$
 select case when length(coalesce(current_setting('request.headers',true)::jsonb ->> header_name,'')) >= case when header_name='x-classroom-key' then 4 else 32 end
 then encode(sha256(convert_to(current_setting('request.headers',true)::jsonb ->> header_name,'UTF8')),'hex') else null end
$$;
create table public.inbox_room_codes (
 code_hash text primary key check(length(code_hash)=64),
 room_hash text not null references public.inbox_rooms(room_hash)
);
create index inbox_room_codes_room on public.inbox_room_codes(room_hash);
alter table public.inbox_room_codes enable row level security;
revoke all on public.inbox_room_codes from anon,authenticated;
grant select on public.inbox_room_codes to anon;
create policy code_read on public.inbox_room_codes for select to anon
 using(code_hash=(select inbox_private.header_hash('x-classroom-key')));
create function inbox_private.current_room_hash() returns text
language sql stable security invoker set search_path = '' as $$
 select coalesce((select room_hash from public.inbox_room_codes where code_hash=inbox_private.header_hash('x-classroom-key')),inbox_private.header_hash('x-classroom-key'))
$$;
revoke all on function inbox_private.current_room_hash() from public;
grant execute on function inbox_private.current_room_hash() to anon;
drop policy room_read on public.inbox_rooms;
create policy room_read on public.inbox_rooms for select to anon
 using (room_hash=(select inbox_private.current_room_hash()));
drop policy assignment_read on public.inbox_assignments;
create policy assignment_read on public.inbox_assignments for select to anon
 using(room_hash=(select inbox_private.current_room_hash()));
drop policy assignment_insert on public.inbox_assignments;
create policy assignment_insert on public.inbox_assignments for insert to anon
 with check(room_hash=(select inbox_private.current_room_hash()) and owner_hash=(select inbox_private.header_hash('x-installation-key')) and deleted_at is null);
drop policy assignment_update on public.inbox_assignments;
create policy assignment_update on public.inbox_assignments for update to anon
 using(room_hash=(select inbox_private.current_room_hash()) and owner_hash=(select inbox_private.header_hash('x-installation-key')))
 with check(room_hash=(select inbox_private.current_room_hash()) and owner_hash=(select inbox_private.header_hash('x-installation-key')));
drop policy submission_read on public.inbox_submissions;
create policy submission_read on public.inbox_submissions for select to anon
 using(room_hash=(select inbox_private.current_room_hash()));
drop policy submission_insert on public.inbox_submissions;
create policy submission_insert on public.inbox_submissions for insert to anon
 with check(room_hash=(select inbox_private.current_room_hash()) and owner_hash=(select inbox_private.header_hash('x-installation-key')) and deleted_at is null
 and exists(select 1 from public.inbox_assignments a where a.id=assignment_id and a.room_hash=inbox_submissions.room_hash and a.deleted_at is null));
drop policy submission_update on public.inbox_submissions;
create policy submission_update on public.inbox_submissions for update to anon
 using(room_hash=(select inbox_private.current_room_hash()) and owner_hash=(select inbox_private.header_hash('x-installation-key')))
 with check(room_hash=(select inbox_private.current_room_hash()) and owner_hash=(select inbox_private.header_hash('x-installation-key')));
