import { SpeechDictation, type DictationError } from './speech-dictation';
import { Bridge, onEvent } from './bridge';
import { State } from './state';
import { t } from '../i18n/i18n';
interface Callbacks { transcript(text:string):void; listening(active:boolean):void; processing?():void; error(code:DictationError):void }
interface InputEvent { requestId:string; state:'listening'|'processing'|'finished'|'error'|'stopped'; text?:string; code?:string }
const errors:Record<string,DictationError>={speech_memory_low:'memory',speech_resources_missing:'resources',speech_resources_invalid:'resources',microphone_unavailable:'permission',no_speech:'no-speech',speech_uncertain:'uncertain',speech_disabled:'disabled',speech_busy:'busy',session_unavailable:'session'};
export function dictationMessage(code:DictationError):string {
  switch(code){
    case 'unavailable': return t("Speech recognition is not available on this device.");
    case 'permission': return t("Microphone access was denied. Allow it in your device settings.");
    case 'no-speech': return t("No speech was detected. Try again.");
    case 'failed': return t("Voice dictation failed. Try again.");
    case 'memory': return t("Not enough free memory for local speech. Close other apps and try again.");
    case 'resources': return t("Local speech files are missing or damaged. Reinstall Novo Companion.");
    case 'uncertain': return t("I could not understand that clearly. Please try again.");
    case 'disabled': return t("Voice input is off. Choose an input mode in Settings → Assistant.");
    case 'busy': return t("Another microphone request is still stopping. Try again in a moment.");
    case 'session': return t("Voice stopped because Windows is locked or unavailable.");
    case 'consent': return t("Voice dictation is off. Enable it in Novo Settings → Assistant to allow the speech service to process audio.");
  }
}
export class CompanionDictation {
  private callbacks:Callbacks; private browser:SpeechDictation;
  private id:string|null=null; private base=''; private phase:'idle'|'starting'|'listening'|'processing'='idle';
  private disposed=false; private ready:Promise<void>; private unsubscribe:(()=>void)|null=null; private available=true;
  constructor(callbacks:Callbacks) {
    this.callbacks=callbacks;
    this.browser=new SpeechDictation(callbacks,undefined,'es-BO');
    this.ready=onEvent<InputEvent>('novo-voice-input',event=>{
      if(this.disposed||event.requestId!==this.id)return;
      if(event.state==='listening'){this.phase='listening';this.callbacks.listening(true);return;}
      if(event.state==='processing'){this.phase='processing';this.callbacks.processing?.();return;}
      this.id=null;this.phase='idle';this.callbacks.listening(false);
      if(event.state==='finished'){
        const text=event.text?.trim();
        if(!text||text.length>12000||text.includes('\0')){this.callbacks.error('uncertain');return;}
        this.callbacks.transcript(this.base+(this.base&&!/\s$/.test(this.base)?' ':'')+text);
      }else if(event.state==='error')this.callbacks.error(errors[event.code??'']??'failed');
    }).then(stop=>{if(this.disposed)stop();else this.unsubscribe=stop;}).catch(()=>{this.available=false;});
  }
  get isListening(){return this.phase!=='idle'||this.browser.isListening;}
  start(draft:string){
    if(this.disposed||this.isListening)return false;
    const mode=State.settings.voiceInputMode??'local';
    if(mode==='off'){this.callbacks.error('disabled');return false;}
    if(mode==='cloud'){
      if(!State.settings.voiceCloudConsent){this.callbacks.error('consent');return false;}
      return this.browser.start(draft);
    }
    const id=crypto.randomUUID();this.id=id;this.base=draft;this.phase='starting';this.callbacks.listening(true);
    void this.ready.then(async()=>{
      if(this.disposed||this.id!==id)return;
      if(!this.available)throw new Error('speech_unavailable');
      await Bridge.voiceInputStart(id);
    }).catch(error=>{
      if(this.disposed||this.id!==id)return;
      this.id=null;this.phase='idle';this.callbacks.listening(false);
      this.callbacks.error(errors[String(error).replace(/^Error:\s*/,'')]??'failed');
    });
    return true;
  }
  stop(){
    if(this.id){
      if(this.phase!=='listening'){this.cancel();return;}
      void Bridge.voiceInputFinish(this.id).catch(()=>this.cancel());
    }else this.browser.stop();
  }
  cancel(){
    const id=this.id;this.id=null;this.phase='idle';this.browser.cancel();
    if(id){void Bridge.voiceInputCancel(id).catch(()=>{});this.callbacks.transcript(this.base);this.callbacks.listening(false);}
  }
  dispose(){if(this.disposed)return;this.cancel();this.disposed=true;this.browser.dispose();this.unsubscribe?.();}
}
