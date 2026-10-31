import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const data=mkdtempSync(join(tmpdir(),'classroom-demo-'));const plugin=resolve(process.argv[2]||'plugins/class-inbox-demo-mac');
async function connect(){const c=new Client({name:'portable-smoke',version:'1'});await c.connect(new StdioClientTransport({command:process.platform==='win32'?join(plugin,'runtime','node.exe'):'/bin/sh',args:[join(plugin,process.platform==='win32'?'server.bundle.mjs':'launch.sh')],env:{PATH:process.platform==='win32'?(process.env.SystemRoot+'\\System32'):'/usr/bin:/bin',SystemRoot:process.env.SystemRoot||'',HOME:data,LOCALAPPDATA:data,TEMP:data,CLASS_INBOX_DATA:join(data,'data')},stderr:'pipe'}));return c;}
let c=await connect();const call=async(name,args={})=>{const r=await c.callTool({name,arguments:args});assert.ok(!r.isError,JSON.stringify(r));return r.structuredContent;};
try{
 assert.equal((await call('inbox_list')).items.length,2);assert.equal((await call('inbox_submissions')).submissions.length,2);
 const html=await c.readResource({uri:'ui://class-inbox/inbox.html'});assert.ok(html.contents[0].text.includes('DEMO'));
 const prompt=await call('inbox_start',{id:'demo-event-page'});assert.ok(prompt.context.includes('AI Creative Day'));
 await call('inbox_delete',{kind:'assignment',id:'demo-event-page'});await c.close();c=await connect();assert.equal((await call('inbox_list')).items.length,1);assert.equal((await call('inbox_submissions')).submissions.length,2);
 await call('inbox_restore',{kind:'assignment',id:'demo-event-page'});assert.equal((await call('inbox_list')).items.length,2);
 console.log('PASS: bundled runtime starts with no Node in PATH, seeds exactly once, tools/resources work, restart preserves deletion and restore.');
}finally{await c.close();rmSync(data,{recursive:true,force:true});}
