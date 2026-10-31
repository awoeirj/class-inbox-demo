import assert from 'node:assert/strict';
import {McpUiMessageRequestSchema} from '@modelcontextprotocol/ext-apps';
import {prepareLesson,lessonMessage} from '../source/lesson-start.mjs';
const assignment={id:'test-lesson',title:'프롬프트 작성 연습',body:'고객에게 교환 방법을 설명하세요.',criteria:'최종 답변과 선택한 프롬프트'};
for(const shared of [false,true]){
 const lesson=prepareLesson(assignment,{shared,roomName:shared?'검증 반':null});const message=lessonMessage(lesson);
 assert.equal(message._meta['openai/message'].target,'new');assert.equal(message._meta['openai/message'].send,true);
 assert.equal(message.content.length,2);const [visible,context]=message.content;
 assert.ok(visible.text.includes(assignment.title));assert.ok(!visible.text.includes(assignment.body));
 assert.deepEqual(context.annotations.audience,['assistant']);assert.ok(context._meta['openai/title']);
 const parsed=McpUiMessageRequestSchema.parse({method:'ui/message',params:message});
 assert.deepEqual(parsed.params.content[1],context);
 assert.ok(context.text.includes(assignment.body));assert.ok(context.text.includes(assignment.id));assert.ok(context.text.includes('학생이 아직 방향을 정하지 않은 상태'));
 assert.ok(context.text.includes(shared?'같은 반 참가자에게 공개':'이 컴퓨터에만 저장'));
}
assert.throws(()=>lessonMessage({visibleText:'',context:'x'}));
console.log('PASS: short visible request, model-only titled context survives MCP schema, correct new-chat routing, local/shared disclosure, coaching instructions, malformed payload rejected.');
