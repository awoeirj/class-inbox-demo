-- Shared classroom capability: high-entropy room code + separate installation identity.
-- No admin key or SECURITY DEFINER function is exposed to clients.
create schema if not exists inbox_private;
revoke all on schema inbox_private from public;
grant usage on schema inbox_private to anon;
create function inbox_private.header_hash(header_name text) returns text
language sql stable security invoker set search_path = '' as $$
 select case when length(coalesce(current_setting('request.headers',true)::jsonb ->> header_name,'')) >= 32
 then encode(sha256(convert_to(current_setting('request.headers',true)::jsonb ->> header_name,'UTF8')),'hex') else null end
$$;
revoke all on function inbox_private.header_hash(text) from public;
grant execute on function inbox_private.header_hash(text) to anon;
create table public.inbox_rooms (
 room_hash text primary key check(length(room_hash)=64), name text not null,
 created_at timestamptz not null default now()
);
alter table public.inbox_rooms enable row level security;
revoke all on public.inbox_rooms from anon, authenticated;
grant select on public.inbox_rooms to anon;
create policy room_read on public.inbox_rooms for select to anon
 using (room_hash=(select inbox_private.header_hash('x-classroom-key')));
create table public.inbox_assignments (
 id uuid primary key default gen_random_uuid(), room_hash text not null references public.inbox_rooms(room_hash),
 owner_hash text not null check(length(owner_hash)=64), title text not null check(length(title) between 1 and 200),
 body text not null check(length(body) between 1 and 20000), criteria text not null default '' check(length(criteria)<=5000),
 created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,room_hash)
);
create index inbox_assignments_room_date on public.inbox_assignments(room_hash,created_at desc,id desc);
create table public.inbox_submissions (
 id uuid primary key default gen_random_uuid(), room_hash text not null references public.inbox_rooms(room_hash),
 owner_hash text not null check(length(owner_hash)=64), assignment_id uuid not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=15000000),
 created_at timestamptz not null default now(), deleted_at timestamptz,
 foreign key(assignment_id,room_hash) references public.inbox_assignments(id,room_hash)
);
create index inbox_submissions_room_date on public.inbox_submissions(room_hash,created_at desc,id desc);
create index inbox_submissions_assignment on public.inbox_submissions(assignment_id,room_hash);
alter table public.inbox_assignments enable row level security;
alter table public.inbox_submissions enable row level security;
revoke all on public.inbox_assignments, public.inbox_submissions from anon,authenticated;
grant select,insert on public.inbox_assignments, public.inbox_submissions to anon;
grant update(deleted_at) on public.inbox_assignments, public.inbox_submissions to anon;
create policy assignment_read on public.inbox_assignments for select to anon
 using(room_hash=(select inbox_private.header_hash('x-classroom-key')));
create policy assignment_insert on public.inbox_assignments for insert to anon
 with check(room_hash=(select inbox_private.header_hash('x-classroom-key')) and owner_hash=(select inbox_private.header_hash('x-installation-key')) and deleted_at is null);
create policy assignment_update on public.inbox_assignments for update to anon
 using(room_hash=(select inbox_private.header_hash('x-classroom-key')) and owner_hash=(select inbox_private.header_hash('x-installation-key')))
 with check(room_hash=(select inbox_private.header_hash('x-classroom-key')) and owner_hash=(select inbox_private.header_hash('x-installation-key')));
create policy submission_read on public.inbox_submissions for select to anon
 using(room_hash=(select inbox_private.header_hash('x-classroom-key')));
create policy submission_insert on public.inbox_submissions for insert to anon
 with check(room_hash=(select inbox_private.header_hash('x-classroom-key')) and owner_hash=(select inbox_private.header_hash('x-installation-key')) and deleted_at is null
 and exists(select 1 from public.inbox_assignments a where a.id=assignment_id and a.room_hash=inbox_submissions.room_hash and a.deleted_at is null));
create policy submission_update on public.inbox_submissions for update to anon
 using(room_hash=(select inbox_private.header_hash('x-classroom-key')) and owner_hash=(select inbox_private.header_hash('x-installation-key')))
 with check(room_hash=(select inbox_private.header_hash('x-classroom-key')) and owner_hash=(select inbox_private.header_hash('x-installation-key')));
