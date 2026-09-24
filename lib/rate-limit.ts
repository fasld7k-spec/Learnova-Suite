const hits=new Map<string,{count:number;reset:number}>();
export function rateLimit(key:string,limit=20,windowMs=60_000){const now=Date.now();const item=hits.get(key);if(!item||item.reset<now){hits.set(key,{count:1,reset:now+windowMs});return {ok:true,remaining:limit-1}}item.count++;return {ok:item.count<=limit,remaining:Math.max(0,limit-item.count)}}
export function resetRateLimit(key:string){hits.delete(key)}
