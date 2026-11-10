const maxBodyBytes=4096;
const retentionSeconds=48*60*60;
const numeric={seconds:600,frames:8192,fps:2000,frameP95Ms:10000,stalls:8192,rttSamples:512,rttP50Ms:60000,rttP95Ms:60000,rttMaxMs:60000,gapSamples:1024,gapP95Ms:60000,gapMaxMs:60000,corrections:1024,correctionP95M:200};
const empty=status=>new Response(null,{status});

export async function savePlaytest(request,storage) {
 if(request.method!=='POST')return empty(405);
 if(!storage)return empty(503);
 if(Number(request.headers.get('Content-Length'))>maxBodyBytes)return empty(413);
 let sample;
 try{
  const reader=request.body?.getReader();
  if(!reader)return empty(400);
  const decoder=new TextDecoder();
  let bytes=0,text='';
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>maxBodyBytes){void reader.cancel().catch(()=>{});return empty(413);}
   text+=decoder.decode(value,{stream:true});
  }
  sample=JSON.parse(text+decoder.decode());
 }catch{return empty(400);}
 if(sample?.v!==1||!['online','bot','practice'].includes(sample.mode)||
    !Number.isInteger(sample.frames)||sample.frames<1||!(sample.seconds>0))return empty(400);
 const record={v:1,mode:sample.mode,receivedAt:new Date().toISOString()};
 for(const [key,max] of Object.entries(numeric)){
  const value=sample[key];
  if(value!==null&&(!Number.isFinite(value)||value<0||value>max))return empty(400);
  record[key]=value;
 }
 try{
  await storage.put(record.receivedAt+'/'+crypto.randomUUID(),JSON.stringify(record),{expirationTtl:retentionSeconds});
  return empty(201);
 }catch{return empty(503);}
}
