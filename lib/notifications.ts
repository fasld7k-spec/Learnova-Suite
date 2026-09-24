import { prisma } from '@/lib/prisma';import { sendEmail } from '@/lib/email';
export async function notify(userId:string,title:string,body:string,email?:string){await prisma.notification.create({data:{userId,title,body}});if(email)await sendEmail({to:email,subject:title,html:`<p>${body}</p>`})}
export async function notifyBeforeLiveSession(){const upcoming=await prisma.liveSession.findMany({where:{startsAt:{gte:new Date(),lte:new Date(Date.now()+60*60*1000)}}});return upcoming.length}
