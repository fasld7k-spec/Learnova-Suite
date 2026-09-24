import { prisma } from '@/lib/prisma';
export async function audit({actorId,action,entity,entityId,metadata,ip}:{actorId?:string;action:string;entity:string;entityId?:string;metadata?:any;ip?:string}){try{return await prisma.auditLog.create({data:{actorId,action,entity,entityId,metadata,ip}})}catch(e){console.warn('audit failed',e)}}
