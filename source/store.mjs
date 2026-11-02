import {normalizeDeadline,isClosed} from './deadlines.mjs';
import {prepareLesson} from './lesson-start.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import demoData from './demo-data.json' with {type:'json'};
const dir=process.env.CLASS_INBOX_DATA || (process.platform==='win32'?join(process.env.LOCALAPPDATA||homedir(),'ClassInboxDemo'):join(homedir(),'Library','Application Support','ClassInboxDemo'));
mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(join(dir,'inbox.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,criteria TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,started_at TEXT);');
if(!db.prepare('PRAGMA table_info(assignments)').all().some(c=>c.name==='due_at'))db.exec('ALTER TABLE assignments ADD COLUMN due_at TEXT');
db.exec('CREATE TABLE IF NOT EXISTS trash(kind TEXT NOT NULL,id TEXT NOT NULL,deleted_at TEXT NOT NULL,PRIMARY KEY(kind,id))');
export function snapshot(){const items=db.prepare('SELECT * FROM assignments WHERE id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\') ORDER BY created_at DESC, id DESC').all();return {items:items.map(x=>({...x,isClosed:isClosed(x)})),unread:items.filter(x=>!x.read_at).length};}
export function publish({title,body,criteria='',dueAt=null}){const id=randomUUID();db.prepare('INSERT INTO assignments(id,title,body,criteria,created_at,due_at) VALUES(?,?,?,?,?,?)').run(id,title,body,criteria,new Date().toISOString(),normalizeDeadline(dueAt));return {id,...snapshot()};}
export function markRead(id){const r=db.prepare('UPDATE assignments SET read_at=COALESCE(read_at,?) WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\')').run(new Date().toISOString(),id);if(!r.changes)throw Error('과제를 찾을 수 없습니다.');return snapshot();}
export function start(id){const item=db.prepare('SELECT * FROM assignments WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\')').get(id);if(!item)throw Error('과제를 찾을 수 없습니다.');return prepareLesson(item);}

export function demo(){return publish({title:'AI로 내 하루를 정리하기',body:'1. 오늘 해야 할 일 5가지를 적어 보세요.\n2. Codex에게 중요도와 예상 소요 시간을 기준으로 정리해 달라고 요청하세요.\n3. 결과를 읽고 실제 일정에 맞게 한 번 수정해 보세요.',criteria:'사용한 요청 문장과 최종 일정, 수정한 이유 한 줄을 준비하세요.'});}

// Submission snapshots preserve the exact selected artifacts and shared messages.
db.exec('CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL)');
for(const [name,type] of [['late','INTEGER NOT NULL DEFAULT 0'],['deadline_at_submission','TEXT']])if(!db.prepare('PRAGMA table_info(submissions)').all().some(c=>c.name===name))db.exec(`ALTER TABLE submissions ADD COLUMN ${name} ${type}`);
export function submissions(){return {submissions:db.prepare('SELECT * FROM submissions WHERE id NOT IN (SELECT id FROM trash WHERE kind=\'submission\') ORDER BY created_at DESC,id DESC').all().map(r=>({...JSON.parse(r.payload),id:r.id,created_at:r.created_at,late:!!r.late,deadline_at_submission:r.deadline_at_submission}))};}
export function submit(input){const assignment=db.prepare('SELECT title,due_at FROM assignments WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\')').get(input.assignmentId);if(!assignment)throw Error('제출할 과제를 찾을 수 없습니다.');const id=randomUUID();db.prepare('INSERT INTO submissions(id,assignment_id,payload,created_at,late,deadline_at_submission) VALUES(?,?,?,?,?,?)').run(id,input.assignmentId,JSON.stringify({...input,assignmentTitle:assignment.title}),new Date().toISOString(),isClosed(assignment)?1:0,assignment.due_at||null);return {id,saved:true,late:isClosed(assignment)};}

export function trashItems(){return {items:db.prepare("SELECT t.kind,t.id,t.deleted_at,CASE WHEN t.kind='assignment' THEN a.title ELSE json_extract(s.payload,'$.title') END AS title FROM trash t LEFT JOIN assignments a ON t.kind='assignment' AND a.id=t.id LEFT JOIN submissions s ON t.kind='submission' AND s.id=t.id ORDER BY t.deleted_at DESC").all()};}
export function moveToTrash(kind,id){const table=kind==='assignment'?'assignments':kind==='submission'?'submissions':null;if(!table)throw Error('잘못된 항목 종류입니다.');if(!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))throw Error('항목을 찾을 수 없습니다.');db.prepare('INSERT OR IGNORE INTO trash VALUES(?,?,?)').run(kind,id,new Date().toISOString());return {deleted:true};}
export function restore(kind,id){const r=db.prepare('DELETE FROM trash WHERE kind=? AND id=?').run(kind,id);if(!r.changes)throw Error('휴지통에서 항목을 찾을 수 없습니다.');return {restored:true};}

// Retire only the known bundled examples once; never seed new installations.
export function ensureDemo(){
 db.exec('CREATE TABLE IF NOT EXISTS demo_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 db.exec('BEGIN IMMEDIATE');
 try{if(!db.prepare('SELECT key FROM demo_meta WHERE key=?').get('retire-seed-v1')){
  for(const a of demoData.assignments){const row=db.prepare('SELECT * FROM assignments WHERE id=?').get(a.id);if(row&&row.title===a.title&&row.body===a.body)moveToTrash('assignment',a.id);}
  for(const s of demoData.submissions){const row=db.prepare('SELECT payload FROM submissions WHERE id=?').get(s.id);if(row&&row.payload===JSON.stringify(s))moveToTrash('submission',s.id);}
  db.prepare('INSERT INTO demo_meta VALUES(?,?)').run('retire-seed-v1','1');
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}

export function setDeadline({id,dueAt=null}){const r=db.prepare("UPDATE assignments SET due_at=? WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind='assignment')").run(normalizeDeadline(dueAt),id);if(!r.changes)throw Error('과제를 찾을 수 없습니다.');return snapshot();}
