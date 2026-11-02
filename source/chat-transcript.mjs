import {readdir,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';import {createInterface} from 'node:readline';
import {join} from 'node:path';import {homedir} from 'node:os';import {randomUUID} from 'node:crypto';
const dataDir=process.env.CLASS_INBOX_DATA||(process.platform==='win32'?join(process.env.LOCALAPPDATA||homedir(),'ClassInboxDemo'):join(homedir(),'Library','Application Support','ClassInboxDemo'));
const previews=join(dataDir,'chat-previews');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function chatIdFromInput(value){const ids=value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[];if(ids.length!==1)throw Error('실습 채팅의 ID 또는 ID가 포함된 링크를 입력해 주세요.');return ids[0].toLowerCase();}
async function locate(dir,id){let found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())found.push(...await locate(p,id));else if(entry.isFile()&&entry.name.endsWith(id+'.jsonl'))found.push(p);}return found;}
export function collectChatRecord(record,state){
 if(record.type!=='event_msg'||record.payload?.type!=='item_completed')return;
 const item=record.payload.item;if(!['UserMessage','AgentMessage'].includes(item?.type))return;
 const parts=Array.isArray(item.content)?item.content:[];let nonText=0;
 const text=parts.map(p=>{if(['text','Text'].includes(p.type))return p.text||'';nonText++;return `[텍스트 외 첨부: ${p.type||'알 수 없는 형식'} — 이 대화 원문에는 파일 내용이 포함되지 않습니다.]`;}).join('\n');
 if(!text)return;const key=item.id||randomUUID();state.messages.set(key,{role:item.type==='UserMessage'?'user':'assistant',text});state.nonText.set(key,nonText);
}
export async function previewChat({chatId,assignmentId}){
 const id=chatIdFromInput(chatId);let files;
 try{files=await locate(join(process.env.CODEX_HOME||join(homedir(),'.codex'),'sessions'),id);}catch(e){if(e.code==='ENOENT')throw Error('이 컴퓨터에 Codex 채팅 기록이 없습니다. 클라우드 채팅은 로컬 기록 가져오기를 지원하지 않습니다.');throw e;}
 if(files.length!==1)throw Error('해당 실습 채팅의 로컬 기록을 하나로 찾지 못했습니다. 채팅 ID를 확인해 주세요.');
 const state={messages:new Map(),nonText:new Map()};let matched=false;
 for await(const line of createInterface({input:createReadStream(files[0]),crlfDelay:Infinity})){
  if(!line.trim())continue;let r;try{r=JSON.parse(line);}catch{throw Error('기록이 저장 중이거나 손상되어 전문을 읽을 수 없습니다. 잠시 후 다시 시도해 주세요.');}
  if(r.type==='session_meta')matched=[r.payload?.id,r.payload?.session_id].some(x=>x?.toLowerCase()===id);
  collectChatRecord(r,state);
 }
 if(!matched)throw Error('요청한 채팅과 기록의 ID가 일치하지 않습니다.');
 const messages=[...state.messages.values()];if(!messages.length)throw Error('전체 대화를 확인할 수 있는 형식의 로컬 기록이 없습니다. 요약으로 대신 제출하지 않습니다.');
 if(JSON.stringify(messages).length>12000000)throw Error('전체 대화가 제출 용량을 초과합니다. 일부를 잘라 제출하지 않았습니다.');
 const previewId=randomUUID(),nonTextCount=[...state.nonText.values()].reduce((a,b)=>a+b,0);
 const snapshot={assignmentId,chatId:id,messages,createdAt:new Date().toISOString(),nonTextCount};
 await mkdir(previews,{recursive:true});await writeFile(join(previews,previewId+'.json'),JSON.stringify(snapshot),{mode:0o600});
 return {previewId,...snapshot,messageCount:messages.length,notice:'사용자와 AI의 전체 텍스트 대화입니다. 시스템·숨김 컨텍스트·내부 추론·도구 실행 로그는 포함하지 않습니다. 이미지와 파일은 결과물로 별도 첨부하세요. 아직 제출되지 않았습니다.'};
}
export async function resolveChatPreview(input){
 if(!input.chatPreviewId)return input;
 if(!uuid.test(input.chatPreviewId))throw Error('대화 확인 정보가 올바르지 않습니다.');
 let saved;try{saved=JSON.parse(await readFile(join(previews,input.chatPreviewId+'.json'),'utf8'));}catch{throw Error('대화 확인 정보를 찾을 수 없습니다. 전체 채팅을 다시 불러와 주세요.');}
 if(saved.assignmentId!==input.assignmentId)throw Error('대화를 불러온 실습과 제출할 실습이 다릅니다. 다시 불러와 주세요.');
 const {chatPreviewId,...rest}=input;
 return {...rest,messages:saved.messages,conversationSource:{kind:'full-chat-text',chatId:saved.chatId,capturedAt:saved.createdAt,messageCount:saved.messages.length,nonTextCount:saved.nonTextCount}};
}
