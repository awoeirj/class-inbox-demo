import {z} from 'zod';
export const assetSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('text'),name:z.string().min(1).max(200),text:z.string().min(1).max(50000)}),
 z.object({type:z.literal('link'),name:z.string().min(1).max(200),url:z.string().url().refine(x=>/^https?:\/\//i.test(x),'HTTP(S) 링크만 사용할 수 있습니다.')}),
 z.object({type:z.literal('file'),name:z.string().min(1).max(200),mime:z.string().max(100),data:z.string().max(7000000).regex(/^data:[a-zA-Z0-9.+/-]*;base64,[A-Za-z0-9+/]*={0,2}$/)})
]);
export const submissionShape={assignmentId:z.string(),author:z.string().trim().min(1).max(80),title:z.string().trim().min(1).max(200),description:z.string().max(3000).default(''),assets:z.array(assetSchema).min(1).max(12),messages:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().min(1).max(50000)})).max(200).default([])};
export const submissionSchema=z.object(submissionShape).refine(x=>JSON.stringify(x).length<=14000000,'한 제출물은 약 10MB 이하로 준비해 주세요.');
