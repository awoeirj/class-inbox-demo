alter table public.inbox_assignments add column due_at timestamptz;
alter table public.inbox_submissions add column late boolean not null default false, add column deadline_at_submission timestamptz;
grant update(due_at) on public.inbox_assignments to anon;
create function inbox_private.enforce_submission_deadline() returns trigger
language plpgsql security invoker set search_path='' as $$
declare assignment_due timestamptz;
begin
 select a.due_at into assignment_due from public.inbox_assignments a
 where a.id=new.assignment_id and a.room_hash=new.room_hash and a.deleted_at is null;
 if not found then raise exception '제출할 과제를 찾을 수 없습니다.'; end if;
 new.created_at := clock_timestamp();
 new.deadline_at_submission := assignment_due;
 new.late := assignment_due is not null and new.created_at >= assignment_due;
 return new;
end;
$$;
revoke all on function inbox_private.enforce_submission_deadline() from public;
create trigger inbox_submission_deadline before insert on public.inbox_submissions
 for each row execute function inbox_private.enforce_submission_deadline();
