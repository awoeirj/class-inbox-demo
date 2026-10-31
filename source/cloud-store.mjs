import {prepareLesson} from './lesson-start.mjs';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import publicConfig from './cloud-public.json' with {type:'json'};
const dir=process.env.CLASS_INBOX_DATA || (process.platform==='win32'?join(process.env.LOCALAPPDATA||homedir(),'ClassInboxDemo'):join(homedir(),'Library','Application Support','ClassInboxDemo'));
mkdirSync(dir,{recursive:true});
const path=join(dir,'cloud.json');
let config=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{mode:'local',identity:randomBytes(32).toString('hex'),read:{}};
config.identity ||= randomBytes(32).toString('hex'); config.read ||= {};
function save(){const tmp=path+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(config),{mode:0o600});renameSync(tmp,path);}
const hash=s=>createHash('sha256').update(s).digest('hex');
const roomHash=()=>hash(config.roomCode);
export function connection(){return {mode:config.mode,roomName:config.roomName||null};}
export function isCloud(){return config.mode==='cloud';}
async function request(resource,{method='GET',body,roomCode=config.roomCode}={}){
 const res=await fetch(`${publicConfig.url}/rest/v1/${resource}`,{method,headers:{apikey:publicConfig.key,'Content-Type':'application/json','x-classroom-key':roomCode||'','x-installation-key':config.identity,Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const text=await res.text();if(!res.ok){let message;try{message=JSON.parse(text).message;}catch{}throw Error(`공유 저장소 요청 실패 (${res.status}): ${message||'연결을 확인해 주세요.'}`);}return text?JSON.parse(text):null;
}
export async function configure({mode,roomCode}){
 if(mode==='local'){config.mode='local';save();return connection();}
 const code=roomCode?.trim();if(!/^[a-f0-9]{64}$/.test(code||''))throw Error('64자리 참가 코드를 확인해 주세요.');
 const rooms=await request('inbox_rooms?select=name',{roomCode:code});if(rooms.length!==1)throw Error('참가 코드를 찾을 수 없습니다.');
 config.mode='cloud';config.roomCode=code;config.roomName=rooms[0].name;save();return connection();
}
async function list(table,filter='deleted_at=is.null'){
 const all=[];for(let offset=0;;offset+=100){const rows=await request(`${table}?${filter}&order=created_at.desc,id.desc&limit=100&offset=${offset}`);all.push(...rows);if(rows.length<100)break;}return all;
}
async function assignment(id){const rows=await request(`inbox_assignments?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`);if(!rows.length)throw Error('과제를 찾을 수 없습니다.');return rows[0];}
function owned(row){return row.owner_hash===hash(config.identity);}
export const cloud={
 async snapshot(){const items=(await list('inbox_assignments')).map(({owner_hash,room_hash,...r})=>({...r,read_at:config.read[room_hash+':'+r.id]||null,canDelete:owner_hash===hash(config.identity)}));return {items,unread:items.filter(x=>!x.read_at).length,connection:connection()};},
 async publish({title,body,criteria=''}){const [r]=await request('inbox_assignments',{method:'POST',body:{room_hash:roomHash(),owner_hash:hash(config.identity),title,body,criteria}});return {id:r.id,...await cloud.snapshot()};},
 async markRead(id){await assignment(id);config.read[roomHash()+':'+id] ||= new Date().toISOString();save();return cloud.snapshot();},
 async start(id){return prepareLesson(await assignment(id),{shared:true,roomName:config.roomName});},
 async demo(){return cloud.publish({title:'[테스트] AI로 하루 일정 정리하기',body:'할 일 5개를 적고 AI에게 우선순위를 정리해 달라고 요청하세요. 결과를 읽고 한 번 수정하세요.',criteria:'최종 일정과 공유할 요청 문장을 제출하세요.'});},
 async submissions(){return {submissions:(await list('inbox_submissions')).map(r=>({...r.payload,id:r.id,created_at:r.created_at,canDelete:owned(r)}))};},
 async submit(input){const a=await assignment(input.assignmentId);const [r]=await request('inbox_submissions',{method:'POST',body:{room_hash:roomHash(),owner_hash:hash(config.identity),assignment_id:a.id,payload:{...input,assignmentTitle:a.title}}});return {id:r.id,saved:true,shared:true};},
 async trashItems(){const items=[];for(const [kind,table] of [['assignment','inbox_assignments'],['submission','inbox_submissions']])for(const r of await list(table,'deleted_at=not.is.null'))if(owned(r))items.push({kind,id:r.id,deleted_at:r.deleted_at,title:r.title||r.payload?.title});return {items:items.sort((a,b)=>b.deleted_at.localeCompare(a.deleted_at))};},
 async moveToTrash(kind,id){return changeTrash(kind,id,new Date().toISOString());},
 async restore(kind,id){return changeTrash(kind,id,null);},
 ensureDemo(){} // Never copy existing local conversations or files into the shared classroom.
};
async function changeTrash(kind,id,deleted_at){const table={assignment:'inbox_assignments',submission:'inbox_submissions'}[kind];if(!table)throw Error('잘못된 항목 종류입니다.');const rows=await request(`${table}?id=eq.${encodeURIComponent(id)}${deleted_at?'':'&deleted_at=not.is.null'}`,{method:'PATCH',body:{deleted_at}});if(!rows.length)throw Error('항목이 없거나 이 컴퓨터에서 작성한 항목이 아닙니다.');return deleted_at?{deleted:true}:{restored:true};}
