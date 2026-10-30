import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'class-inbox-test-'));
async function connect(){const c=new Client({name:'class-inbox-check',version:'1'});await c.connect(new StdioClientTransport({command:process.execPath,args:['server.mjs'],env:{...process.env,CLASS_INBOX_DATA:dir,CLASS_INBOX_NO_DEMO:'1'},stderr:'pipe'}));return c;}
let c=await connect();const call=async(name,args={})=>{const r=await c.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent;};
try{
 const tools=await c.listTools();assert.equal(tools.tools.find(x=>x.name==='inbox_open')._meta['openai/ui'].entrypoints[0].type,'global');
 assert.equal((await call('inbox_open')).unread,0);
 const first=await call('inbox_publish',{title:'검증용 과제',body:'첫 번째 줄\n두 번째 줄',criteria:'결과를 확인하기'});assert.equal(first.unread,1);
 await call('inbox_demo');assert.equal((await call('inbox_list')).unread,2);
 assert.equal((await call('inbox_read',{id:first.id})).unread,1);
 assert.equal((await call('inbox_read',{id:first.id})).unread,1);
 const prompt=await call('inbox_start',{id:first.id});assert.ok(prompt.prompt.includes('검증용 과제'));
 const payload={assignmentId:first.id,author:'테스터',title:'혼합 결과물',description:'여러 형식 검증',assets:[{type:'text',name:'글',text:'<script>예시 원문</script>'},{type:'link',name:'링크',url:'https://example.com'},{type:'file',name:'note.txt',mime:'text/plain',data:'data:text/plain;base64,aGVsbG8='}],messages:[{role:'user',text:'실제 요청'},{role:'assistant',text:'실제 응답'}]};
 const saved=await call('inbox_submit',payload);assert.ok(saved.saved);
 const found=(await call('inbox_submissions')).submissions.find(x=>x.id===saved.id);assert.deepEqual(found.assets,payload.assets);assert.deepEqual(found.messages,payload.messages);
 for(const bad of [{...payload,assignmentId:'missing'},{...payload,assets:[]},{...payload,assets:[{type:'link',name:'bad',url:'javascript:alert(1)'}]},{...payload,assets:[{type:'file',name:'bad',mime:'image/png',data:'broken'}]}]){assert.equal((await c.callTool({name:'inbox_submit',arguments:bad})).isError,true);}
 const missing=await c.callTool({name:'inbox_read',arguments:{id:'missing'}});assert.equal(missing.isError,true);
 const resource=await c.readResource({uri:'ui://class-inbox/inbox.html'});assert.ok(resource.contents[0].text.includes('실습함'));
 await call('inbox_delete',{kind:'assignment',id:first.id});
 assert.ok(!(await call('inbox_list')).items.some(x=>x.id===first.id));
 assert.equal((await call('inbox_submissions')).submissions.length,1);
 assert.equal((await c.callTool({name:'inbox_start',arguments:{id:first.id}})).isError,true);
 assert.equal((await c.callTool({name:'inbox_submit',arguments:payload})).isError,true);
 await call('inbox_delete',{kind:'submission',id:saved.id});
 assert.equal((await call('inbox_submissions')).submissions.length,0);
 assert.equal((await call('inbox_trash')).items.length,2);
 await c.close();c=await connect();
 assert.equal((await call('inbox_trash')).items.length,2);
 await call('inbox_restore',{kind:'assignment',id:first.id});
 await call('inbox_restore',{kind:'submission',id:saved.id});
 assert.deepEqual((await call('inbox_submissions')).submissions[0].assets,payload.assets);
 assert.equal((await call('inbox_trash')).items.length,0);
 assert.equal((await c.callTool({name:'inbox_delete',arguments:{kind:'assignment',id:'missing'}})).isError,true);
 await c.close();c=await connect();const restored=await call('inbox_list');assert.equal(restored.items.length,2);assert.equal(restored.unread,1);
 assert.equal((await call('inbox_submissions')).submissions.length,1);
 console.log('PASS: delete/restore, trash persistence, preserve submissions, reject deleted assignment use; mixed submissions, message fidelity, invalid URL/file rejection, submission persistence; sidebar metadata, publish, unread/read, start draft, unknown ID, UI resource, restart persistence');
}finally{await c.close();rmSync(dir,{recursive:true,force:true});}
