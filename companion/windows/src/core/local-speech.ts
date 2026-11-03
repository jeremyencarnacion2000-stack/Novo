export interface LocalVoice { id:string; name:string; spanish:boolean }
export interface SpeechEvent { requestId:string; state:'speaking'|'finished'|'stopped'|'error'; code?:string }
interface SpeechApi { voiceSpeak(requestId:string,text:string):Promise<void>; voiceStop(requestId:string):Promise<void> }
type Subscribe = (name:string,callback:(event:SpeechEvent)=>void)=>Promise<()=>void>;
export function speechText(markdown:string):string {
  return Array.from(markdown.replace(/```[\s\S]*?(?:```|$)/g,' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,' ')
    .replace(/^[\s#>*-]+/gm,'').replace(/[`*_~]/g,'').replace(/\s+/g,' ').trim()).slice(0,6000).join('');
}
const CODES=new Set(['spanish_voice_missing','voice_not_found','session_unavailable','speech_unavailable']);
export class LocalSpeech {
  state:{status:'idle'|'starting'|'speaking'|'error';requestId:string|null;error:string|null}={status:'idle',requestId:null,error:null};
  private api:SpeechApi; private changed:()=>void; private generation=0; private disposed=false;
  private unsubscribe:(()=>void)|null=null; private ready:Promise<void>; private available=true;
  constructor(api:SpeechApi,subscribe:Subscribe,changed:()=>void) {
    this.api=api;this.changed=changed;
    this.ready=subscribe('novo-speech-state',event=>{
      if(this.disposed||event.requestId!==this.state.requestId)return;
      if(event.state==='speaking')this.state.status='speaking';
      else {this.state.status=event.state==='error'?'error':'idle';this.state.requestId=null;}
      if(event.state==='error')this.state.error=CODES.has(event.code??'')?event.code!:'speech_unavailable';
      this.changed();
    }).then(stop=>{if(this.disposed)stop();else this.unsubscribe=stop;}).catch(()=>{this.available=false;});
  }
  async play(markdown:string) {
    if(this.disposed)return;
    this.stop();const text=speechText(markdown);if(!text)return;
    const generation=this.generation;const id=crypto.randomUUID();
    this.state={status:'starting',requestId:id,error:null};this.changed();
    try {
      await this.ready;if(this.disposed||generation!==this.generation)return;
      if(!this.available)throw new Error('speech_unavailable');
      await this.api.voiceSpeak(id,text);
      if(this.disposed||generation!==this.generation)await this.api.voiceStop(id).catch(()=>{});
    }catch(error){
      if(this.disposed||generation!==this.generation)return;
      const code=String(error).replace(/^Error:\s*/,'');
      this.state={status:'error',requestId:null,error:CODES.has(code)?code:'speech_unavailable'};this.changed();
    }
  }
  stop() {
    ++this.generation;const id=this.state.requestId;
    this.state={status:'idle',requestId:null,error:null};
    if(id)void this.api.voiceStop(id).catch(()=>{});
    this.changed();
  }
  dispose(){if(this.disposed)return;this.stop();this.disposed=true;this.unsubscribe?.();}
}
