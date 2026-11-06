import { Bridge, onEvent } from '../core/bridge';
import { LocalSpeech } from '../core/local-speech';
import { State } from '../core/state';
import { N_, t } from '../i18n/i18n';
import { h, svg } from './dom';
import { ICONS } from './icons';

export function buildReplySpeech(beforeSpeak:()=>void) {
  const labels={read:N_("Read latest reply"),stop:N_("Stop speaking")};
  let text='';let context='';let voice=State.settings.voiceLocalVoiceId;let automatic=State.settings.voiceSpokenReplies;let disposed=false;
  const button=h('button',{type:'button',class:'novo-chat-settings novo-reply-speech','aria-label':t(labels.read),disabled:true},svg(ICONS.speakerOn,12));
  const status=h('div',{class:'novo-voice-status',role:'status',hidden:true});
  const speech=new LocalSpeech(Bridge,onEvent,draw);
  function draw() {
    if(disposed)return;
    const active=speech.state.status==='speaking'||speech.state.status==='starting';
    button.disabled=!text&&!active;
    button.setAttribute('aria-label',t(active?labels.stop:labels.read));
    button.setAttribute('aria-pressed',String(active));
    button.replaceChildren(svg(active?ICONS.stop:ICONS.speakerOn,12));
    status.hidden=speech.state.status!=='error';
    status.textContent=speech.state.error==='spanish_voice_missing'
      ?t("No local Spanish voice. Install one in Windows Settings → Time & language → Speech.")
      :speech.state.error?t("Local speech is unavailable. Check your Windows voice settings."):'';
  }
  function play(){if(!text||disposed)return;beforeSpeak();void speech.play(text);}
  button.addEventListener('click',()=>{if(speech.state.requestId)speech.stop();else play();});
  return {el:button,status,
    update(key:string,content:string){if(key!==context){context=key;speech.stop();}text=key?content:'';draw();},
    readReply(force=false){if((force||State.settings.voiceSpokenReplies)&&State.view==='prompt')play();},
    settingsChanged(){if(voice!==State.settings.voiceLocalVoiceId||(automatic&&!State.settings.voiceSpokenReplies))speech.stop();voice=State.settings.voiceLocalVoiceId;automatic=State.settings.voiceSpokenReplies;},
    stop:()=>speech.stop(),
    dispose(){if(disposed)return;speech.dispose();disposed=true;},
  };
}
