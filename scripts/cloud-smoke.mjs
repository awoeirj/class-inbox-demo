import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const code=process.env.CLASS_INBOX_TEST_ROOM;
if(!code)throw Error('CLASS_INBOX_TEST_ROOM must identify a dedicated test room.');
const dirs=[0,1,2].map(()=>mkdtempSync(join(tmpdir(),'class-cloud-'))),clients=[];
async function connect(dir){const c=new Client({name:'cloud-verification',version:'1'});await c.connect(new StdioClientTransport({command:process.execPath,args:['source/server.mjs'],env:{...process.env,CLASS_INBOX_DATA:dir,CLASS_INBOX_NO_DEMO:'1'},stderr:'pipe'}));clients.push(c);return c;}
async function call(c,name,args={}){const r=await c.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent;}
try{
 const a=await connect(dirs[0]),b=await connect(dirs[1]),outsider=await connect(dirs[2]);
 await call(a,'inbox_connect',{mode:'cloud',roomCode:code});await call(b,'inbox_connect',{mode:'cloud',roomCode:code});
 assert.equal((await outsider.callTool({name:'inbox_connect',arguments:{mode:'cloud',roomCode:randomBytes(32).toString('hex')}})).isError,true);
 const initial=await call(a,'inbox_publish',{title:'연동 검증: 두 사용자',body:'공유 수신과 제출 확인',criteria:'텍스트·파일·링크'});
 assert.ok((await call(b,'inbox_list')).items.some(x=>x.id===initial.id));
 await call(a,'inbox_read',{id:initial.id});assert.equal((await call(b,'inbox_list')).items.find(x=>x.id===initial.id).read_at,null);
 assert.equal((await b.callTool({name:'inbox_delete',arguments:{kind:'assignment',id:initial.id}})).isError,true);
 const input={assignmentId:initial.id,author:'검증용 B',title:'혼합 결과물 검증',description:'실제 사용자 데이터 아님',assets:[{type:'text',name:'글',text:'원문 <b>유지</b>'},{type:'link',name:'링크',url:'https://example.com/'},{type:'file',name:'hello.txt',mime:'text/plain',data:'data:text/plain;base64,aGVsbG8='}],messages:[{role:'user',text:'검증용 요청'},{role:'assistant',text:'검증용 응답'}]};
 const submission=await call(b,'inbox_submit',input);
 const rows=(await call(a,'inbox_submissions')).submissions;const row=rows.find(x=>x.id===submission.id);assert.deepEqual(row.assets,input.assets);assert.deepEqual(row.messages,input.messages);assert.equal(row.canDelete,false);
 assert.equal((await a.callTool({name:'inbox_delete',arguments:{kind:'submission',id:submission.id}})).isError,true);
 await call(b,'inbox_delete',{kind:'submission',id:submission.id});assert.ok(!(await call(a,'inbox_submissions')).submissions.some(x=>x.id===submission.id));await call(b,'inbox_restore',{kind:'submission',id:submission.id});
 await call(a,'inbox_delete',{kind:'assignment',id:initial.id});assert.equal((await b.callTool({name:'inbox_submit',arguments:input})).isError,true);await call(a,'inbox_restore',{kind:'assignment',id:initial.id});
 await b.close();const restarted=await connect(dirs[1]);assert.equal((await call(restarted,'inbox_connection')).mode,'cloud');assert.ok((await call(restarted,'inbox_submissions')).submissions.some(x=>x.id===submission.id&&x.canDelete));
 // Direct Data API checks: guessed room and missing room header cannot read data;
 // owner hashes returned by reads cannot substitute for secret installation tokens.
 const pub=JSON.parse(readFileSync('source/cloud-public.json','utf8'));const cfg=JSON.parse(readFileSync(join(dirs[0],'cloud.json'),'utf8'));
 const headers={apikey:pub.key,'Content-Type':'application/json','x-classroom-key':code,'x-installation-key':cfg.identity};
 const raw=await fetch(pub.url+'/rest/v1/inbox_assignments?select=*',{headers});const data=await raw.json();assert.ok(data.some(x=>x.id===initial.id));
 for(const extra of [{},{'x-classroom-key':randomBytes(32).toString('hex')}]){const r=await fetch(pub.url+'/rest/v1/inbox_assignments?select=*',{headers:{apikey:pub.key,...extra}});assert.equal(r.status,200);assert.deepEqual(await r.json(),[]);}
 const ownerHash=data.find(x=>x.id===initial.id).owner_hash;
 const forged=await fetch(pub.url+'/rest/v1/inbox_assignments?id=eq.'+initial.id,{method:'PATCH',headers:{...headers,'x-installation-key':ownerHash,Prefer:'return=representation'},body:JSON.stringify({deleted_at:new Date().toISOString()})});assert.deepEqual(await forged.json(),[]);
 const rewrite=await fetch(pub.url+'/rest/v1/inbox_assignments?id=eq.'+initial.id,{method:'PATCH',headers,body:JSON.stringify({owner_hash:randomBytes(32).toString('hex')})});assert.equal(rewrite.ok,false);
 await call(a,'inbox_connect',{mode:'local'});assert.equal((await call(a,'inbox_list')).items.length,0);
 console.log('PASS cloud: independent clients, read state isolation, selected messages + file roundtrip, delete/restore ownership, deleted-assignment rejection, restart persistence, invalid room/no-header isolation, forged owner rejection, immutable ownership, local mode isolation.');
}finally{await Promise.allSettled(clients.map(c=>c.close()));for(const d of dirs)rmSync(d,{recursive:true,force:true});}
