export function normalizeDeadline(value){
 if(value==null||value==='')return null;
 const timestamp=Date.parse(value);if(!Number.isFinite(timestamp))throw Error('마감 날짜와 시간을 확인해 주세요.');
 return new Date(timestamp).toISOString();
}
export function isClosed(assignment){return !!assignment.due_at&&Date.now()>=Date.parse(assignment.due_at);}
