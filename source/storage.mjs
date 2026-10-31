import * as local from './store.mjs';
import {cloud,isCloud,connection,configure} from './cloud-store.mjs';
export {connection,configure};
const route=name=>(...args)=>(isCloud()?cloud:local)[name](...args);
export const snapshot=async()=>{const result=await route('snapshot')();return {...result,connection:connection()};};
export const publish=route('publish'),markRead=route('markRead'),start=route('start'),demo=route('demo'),submissions=route('submissions'),submit=route('submit'),trashItems=route('trashItems'),moveToTrash=route('moveToTrash'),restore=route('restore'),ensureDemo=route('ensureDemo');
