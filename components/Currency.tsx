export function Currency({value,symbol='$'}:{value:any;symbol?:string}){return <>{symbol}{Number(value||0).toFixed(2)}</>}
