// Vercel's standard Web Request/Response handler; no database or third-party telemetry service.
const numeric={seconds:600,frames:8192,fps:2000,frameP95Ms:10000,stalls:8192,rttSamples:512,rttP50Ms:60000,rttP95Ms:60000,rttMaxMs:60000,gapSamples:1024,gapP95Ms:60000,gapMaxMs:60000,corrections:1024,correctionP95M:200};
export default {
 async fetch(request){
  const headers={'Cache-Control':'no-store'};
  if(request.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST'}});
  if(request.headers.get('Origin')!==new URL(request.url).origin)return new Response(null,{status:403,headers});
  if(Number(request.headers.get('Content-Length')??0)>4096)return new Response(null,{status:413,headers});
  let data;try{const text=await request.text();if(text.length>4096)return new Response(null,{status:413,headers});data=JSON.parse(text);}catch{return new Response(null,{status:400,headers});}
  if(!data||data.v!==1||!['play','synthetic'].includes(data.source)||!['online','bot','practice'].includes(data.mode)||typeof data.report!=='string'||!/^[A-F0-9]{8}$/.test(data.report)||!Number.isInteger(data.window)||data.window<1||data.window>40)return new Response(null,{status:400,headers});
  const clean={v:1,source:data.source,report:data.report,window:data.window,mode:data.mode};
  for(const [key,max] of Object.entries(numeric)){
   const value=data[key];if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max))return new Response(null,{status:400,headers});clean[key]=value;
  }
  // Only the explicit numeric allowlist reaches logs. No request headers, body dump, tokens, room codes or user agent.
  console.log('harbor_playtest '+JSON.stringify(clean));
  return Response.json({ok:true,report:data.report},{headers});
 },
};
