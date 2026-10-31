import {setupTrash} from './trash.js';
import {setupGallery} from './gallery.js';
import {App} from '@modelcontextprotocol/ext-apps';
const app=new App({name:'실습함',version:'0.1.0'},{},{autoResize:true});
let state={items:[],unread:0},selected=null,connected=false,busy=false;
let activeConnection={mode:'local'};
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg,error=false){$('status').textContent=msg;$('status').className=error?'error':'';}
function data(r){if(r.isError)throw Error(r.content?.find(x=>x.type==='text')?.text||'요청에 실패했습니다.');return r.structuredContent || JSON.parse(r.content.find(x=>x.type==='text').text);}
async function call(name,args={}){return data(await app.callServerTool({name,arguments:args}));}
function render(){
 if(state.connection)activeConnection=state.connection;
 const shared=activeConnection.mode==='cloud';
 $('connection-button').textContent=shared?activeConnection.roomName+' · 공유 중':'반 연결';
 $('storage-note').textContent=shared?'Supabase 공유 저장소 · 같은 반 참가자에게 공개됩니다.':'로컬 데모 · 이 컴퓨터에만 저장됩니다.';
 $('submission-sharing-note').textContent=shared?'제출한 결과물과 선택한 대화는 같은 반 참가자 모두에게 공개됩니다.':'추가한 결과물과 대화는 이 컴퓨터에만 저장됩니다.';
 $('count').textContent=state.unread;$('count').hidden=!state.unread;
 $('summary').textContent=state.unread?`아직 확인하지 않은 실습이 ${state.unread}개 있어요.`:'새로운 실습을 모두 확인했어요.';
 $('list').innerHTML=state.items.length?state.items.map(x=>`<button class="item ${x.id===selected?'selected':''}" data-id="${escape(x.id)}"><span class="dot ${x.read_at?'read':''}"></span><span><strong>${escape(x.title)}</strong><small>${new Date(x.created_at).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${x.read_at?'확인함':'새 실습'}</small></span><span class="arrow">›</span></button>`).join(''):'<div class="empty">아직 도착한 실습이 없어요.<br>오른쪽 위에서 테스트 실습을 보내보세요.</div>';
 const x=state.items.find(x=>x.id===selected);
 $('detail').innerHTML=x?`${x.canDelete===false?'':'<button id="delete-assignment" class="delete-button">실습 삭제</button>'}<div class="eyebrow">ASSIGNMENT</div><h2>${escape(x.title)}</h2><div class="section-label">실습 안내</div><p class="body">${escape(x.body)}</p><div class="criteria"><div class="section-label">제출 조건</div><p>${escape(x.criteria||'별도 조건 없음')}</p></div><button id="start" class="primary">이 실습 시작 <span>↗</span></button><p class="hint">누르면 새 채팅에 과제를 자동으로 보내고 실습을 바로 시작해요.</p>`:'<div class="placeholder"><div class="symbol">▤</div><h2>도착한 실습을 열어보세요</h2><p>과제를 확인하고 바로 Codex와 시작할 수 있어요.</p></div>';
 document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openItem(b.dataset.id));
 if(x){$('start').onclick=()=>startItem(x);if($('delete-assignment'))$('delete-assignment').onclick=async()=>{try{if(await removeItem('assignment',x)){selected=null;await refresh();render();}}catch(e){toast(e.message,true);}};}
}
async function openItem(id){try{selected=id;state=await call('inbox_read',{id});render();}catch(e){toast(e.message,true);}}
async function refresh(){if(!connected||busy)return;try{const next=await call('inbox_list');if(JSON.stringify(next)!==JSON.stringify(state)){state=next;render();}toast('연결됨 · 새 실습을 자동으로 확인 중');}catch(e){toast('연결을 확인해 주세요 · '+e.message,true);}}
async function startItem(x){const button=$('start');button.disabled=true;try{if(!app.getHostCapabilities()?.experimental?.['openai/message'])throw Error('이 화면에서는 새 채팅 자동 시작을 지원하지 않습니다. Codex의 실습함에서 다시 시도해 주세요.');const {prompt}=await call('inbox_start',{id:x.id});const result=await app.sendMessage({role:'user',content:[{type:'text',text:prompt}],_meta:{'openai/message':{target:'new',send:true}}});if(result?.isError)throw Error('새 채팅을 열지 못했습니다.');toast('새 채팅으로 실습 시작 요청을 보냈어요.');}catch(e){toast(e.message,true);}finally{button.disabled=false;}}
$('demo').onclick=async()=>{if(!connected)return;busy=true;$('demo').disabled=true;try{state=await call('inbox_demo');render();toast('새 실습을 받았어요. 목록에서 확인해 보세요.');}catch(e){toast(e.message,true);}finally{busy=false;$('demo').disabled=false;}};
$('refresh').onclick=refresh;
$('teacher').onclick=()=>$('publish').showModal();
$('cancel').onclick=()=>$('publish').close();
$('form').onsubmit=async e=>{e.preventDefault();if(!connected)return;busy=true;const b=$('publish-button');b.disabled=true;try{state=await call('inbox_publish',{title:$('title').value.trim(),body:$('body').value.trim(),criteria:$('criteria').value.trim()});$('publish').close();$('form').reset();render();toast('실습을 보냈어요.');}catch(e){toast(e.message,true);}finally{busy=false;b.disabled=false;}};
app.ontoolresult=r=>{try{const next=data(r);if(Array.isArray(next.items)){state=next;render();}}catch(e){toast(e.message,true);}};
app.onhostcontextchanged=ctx=>{if(ctx.theme)document.documentElement.dataset.theme=ctx.theme;};
const removeItem=setupTrash(call,toast);
setupGallery(call,toast,removeItem);
window.addEventListener('inbox-changed',refresh);
render();
try{await app.connect();connected=true;document.documentElement.dataset.theme=app.getHostContext()?.theme||'light';await refresh();setInterval(refresh,10000);}catch(e){toast('Codex의 실습함 탭에서 열어주세요. '+e.message,true);}

$('connection-button').onclick=()=>$('connection-dialog').showModal();
$('connection-close').onclick=()=>$('connection-dialog').close();
async function switchConnection(mode){$('connection-error').textContent='';$('connection-join').disabled=true;$('connection-local').disabled=true;try{await call('inbox_connect',{mode,roomCode:$('room-code').value.trim()});selected=null;window.dispatchEvent(new Event('inbox-connection-changed'));$('room-code').value='';await refresh();window.dispatchEvent(new Event('inbox-changed'));$('connection-dialog').close();}catch(e){$('connection-error').textContent=e.message;}finally{$('connection-join').disabled=false;$('connection-local').disabled=false;}}
$('connection-join').onclick=()=>switchConnection('cloud');
$('connection-local').onclick=()=>switchConnection('local');
