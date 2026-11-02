import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const root=mkdtempSync(join(tmpdir(),'chat-transcript-test-'));process.env.CODEX_HOME=root;process.env.CLASS_INBOX_DATA=join(root,'data');mkdirSync(join(root,'sessions'));
const {previewChat,resolveChatPreview}=await import('../source/chat-transcript.mjs');
const id='11111111-2222-4333-8444-555555555555';
const event=(type,id,content)=>({type:'event_msg',payload:{type:'item_completed',item:{type,id,content}}});
const original='  줄바꿈과 공백 보존\n'+ '긴 원문'.repeat(15000)+'\n끝  ';
const records=[{type:'session_meta',payload:{id}},event('UserMessage','u1',[{type:'text',text:original}]),event('AgentMessage','a1',[{type:'Text',text:'첫 응답'}]),{type:'compacted',payload:{message:'요약은 수집하면 안 됨'}},event('Reasoning','r1',[{type:'Text',text:'비공개 추론'}]),event('McpToolCall','t1',[{type:'Text',text:'도구 로그'}]),{type:'response_item',payload:{type:'message',role:'developer',content:[{type:'text',text:'숨김 지침'}]}},event('AgentMessage','a1',[{type:'Text',text:'최종 응답'}]),event('UserMessage','u2',[{type:'image',url:'private-image'}])];
writeFileSync(join(root,'sessions','rollout-'+id+'.jsonl'),records.map(x=>JSON.stringify(x)).join('\n')+'\n');
try{const preview=await previewChat({chatId:'codex://threads/'+id,assignmentId:'assignment'});assert.equal(preview.messageCount,3);assert.equal(preview.messages[0].text,original);assert.equal(preview.messages[1].text,'최종 응답');assert.equal(preview.nonTextCount,1);
const resolved=await resolveChatPreview({assignmentId:'assignment',messages:[{role:'user',text:'모델이 요약한 일부'}],chatPreviewId:preview.previewId});assert.deepEqual(resolved.messages,preview.messages);assert.equal(resolved.conversationSource.messageCount,3);assert.ok(!JSON.stringify(resolved).includes('비공개 추론'));assert.ok(!JSON.stringify(resolved).includes('숨김 지침'));
await assert.rejects(resolveChatPreview({assignmentId:'other',chatPreviewId:preview.previewId}));await assert.rejects(previewChat({chatId:'../../private',assignmentId:'assignment'}));
console.log('PASS full transcript: >50k original text, whitespace, source order, duplicate item replacement, no compaction summary/internal reasoning/tools, media notice, immutable confirmed snapshot, assignment binding, invalid ID rejection.');
}finally{rmSync(root,{recursive:true,force:true});}
