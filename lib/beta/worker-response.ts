// Worker RPCs carry bounded metadata. Reject damaged bytes before interpreting a job.
export async function workerJSON(response:Response){
 const fail=()=>Error('Worker database response unavailable.');
 if(!response.ok){void response.body?.cancel().catch(()=>{});throw fail();}
 const reader=response.body?.getReader();if(!reader)throw fail();
 const chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>2097152)throw fail();
   chunks.push(value);
  }
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }catch{
  void reader.cancel().catch(()=>{});throw fail();
 }finally{reader.releaseLock();}
}
