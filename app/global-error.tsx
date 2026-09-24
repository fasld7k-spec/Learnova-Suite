'use client';
export default function GlobalError({error,reset}:{error:Error;reset:()=>void}){return <html><body><main style={{minHeight:'100vh',display:'grid',placeItems:'center',fontFamily:'Arial'}}><section><h1>Application Error</h1><p>{error.message}</p><button onClick={reset}>Try again</button></section></main></body></html>}
