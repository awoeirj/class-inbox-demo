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
db.exec('CREATE TABLE IF NOT EXISTS trash(kind TEXT NOT NULL,id TEXT NOT NULL,deleted_at TEXT NOT NULL,PRIMARY KEY(kind,id))');
export function snapshot(){const items=db.prepare('SELECT * FROM assignments WHERE id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\') ORDER BY created_at DESC, id DESC').all();return {items,unread:items.filter(x=>!x.read_at).length};}
export function publish({title,body,criteria=''}){const id=randomUUID();db.prepare('INSERT INTO assignments(id,title,body,criteria,created_at) VALUES(?,?,?,?,?)').run(id,title,body,criteria,new Date().toISOString());return {id,...snapshot()};}
export function markRead(id){const r=db.prepare('UPDATE assignments SET read_at=COALESCE(read_at,?) WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\')').run(new Date().toISOString(),id);if(!r.changes)throw Error('과제를 찾을 수 없습니다.');return snapshot();}
export function start(id){const item=db.prepare('SELECT * FROM assignments WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\')').get(id);if(!item)throw Error('과제를 찾을 수 없습니다.');return {prompt:`다음 실습을 함께 진행해 줘. 먼저 목표와 진행 순서를 간단히 설명하고 내가 직접 해볼 수 있게 안내해 줘.\n\n제목: ${item.title}\n\n실습 내용:\n${item.body}\n\n제출 조건:\n${item.criteria || '별도 조건 없음'}\n\n실습 ID: ${id}\n\n제출 안내: 사용자가 제출을 요청하면 제목, 닉네임, 최종 결과물(텍스트·이미지·파일·링크), 공개할 대화 원문을 먼저 보여주고 확인받으세요. 확인한 내용만 inbox_submit 도구로 저장하세요. 현재는 이 컴퓨터에만 저장하는 테스트입니다. 대화 기록을 추측해 만들지 마세요.`};}
export function demo(){return publish({title:'AI로 내 하루를 정리하기',body:'1. 오늘 해야 할 일 5가지를 적어 보세요.\n2. Codex에게 중요도와 예상 소요 시간을 기준으로 정리해 달라고 요청하세요.\n3. 결과를 읽고 실제 일정에 맞게 한 번 수정해 보세요.',criteria:'사용한 요청 문장과 최종 일정, 수정한 이유 한 줄을 준비하세요.'});}

// Submission snapshots preserve the exact selected artifacts and shared messages.
db.exec('CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL)');
export function submissions(){return {submissions:db.prepare('SELECT * FROM submissions WHERE id NOT IN (SELECT id FROM trash WHERE kind=\'submission\') ORDER BY created_at DESC,id DESC').all().map(r=>({...JSON.parse(r.payload),id:r.id,created_at:r.created_at}))};}
export function submit(input){const assignment=db.prepare('SELECT title FROM assignments WHERE id=? AND id NOT IN (SELECT id FROM trash WHERE kind=\'assignment\')').get(input.assignmentId);if(!assignment)throw Error('제출할 과제를 찾을 수 없습니다.');const id=randomUUID();db.prepare('INSERT INTO submissions VALUES(?,?,?,?)').run(id,input.assignmentId,JSON.stringify({...input,assignmentTitle:assignment.title}),new Date().toISOString());return {id,saved:true};}

export function trashItems(){return {items:db.prepare("SELECT t.kind,t.id,t.deleted_at,CASE WHEN t.kind='assignment' THEN a.title ELSE json_extract(s.payload,'$.title') END AS title FROM trash t LEFT JOIN assignments a ON t.kind='assignment' AND a.id=t.id LEFT JOIN submissions s ON t.kind='submission' AND s.id=t.id ORDER BY t.deleted_at DESC").all()};}
export function moveToTrash(kind,id){const table=kind==='assignment'?'assignments':kind==='submission'?'submissions':null;if(!table)throw Error('잘못된 항목 종류입니다.');if(!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))throw Error('항목을 찾을 수 없습니다.');db.prepare('INSERT OR IGNORE INTO trash VALUES(?,?,?)').run(kind,id,new Date().toISOString());return {deleted:true};}
export function restore(kind,id){const r=db.prepare('DELETE FROM trash WHERE kind=? AND id=?').run(kind,id);if(!r.changes)throw Error('휴지통에서 항목을 찾을 수 없습니다.');return {restored:true};}

export function ensureDemo(){
 if(process.env.CLASS_INBOX_NO_DEMO==='1')return;
 db.exec('CREATE TABLE IF NOT EXISTS demo_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 db.exec('BEGIN IMMEDIATE');
 try{if(!db.prepare('SELECT key FROM demo_meta WHERE key=?').get('seed-v1')){
  for(const a of demoData.assignments)db.prepare('INSERT OR IGNORE INTO assignments(id,title,body,criteria,created_at) VALUES(?,?,?,?,?)').run(a.id,a.title,a.body,a.criteria,a.created_at);
  for(const s of demoData.submissions)db.prepare('INSERT OR IGNORE INTO submissions VALUES(?,?,?,?)').run(s.id,s.assignmentId,JSON.stringify(s),s.created_at);
  db.prepare('INSERT INTO demo_meta VALUES(?,?)').run('seed-v1','1');
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
