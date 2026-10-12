import { h } from '../views/dom';
import { t } from '../i18n/i18n';

export const SETTINGS_SECTIONS=['account','assistant','connections','desktop'] as const;
export type SettingsSection=typeof SETTINGS_SECTIONS[number];
export function settingsSection(value:unknown):SettingsSection|null {
  return typeof value==='string'&&SETTINGS_SECTIONS.includes(value as SettingsSection)?value as SettingsSection:null;
}

export function settingsNavigation(initial:SettingsSection,onChange:(section:SettingsSection)=>void){
  const labels={account:t("Account and privacy"),assistant:t("Assistant"),connections:t("Connections"),desktop:t("Desktop")};
  const nav=h('nav',{class:'settings-nav',role:'tablist','aria-label':t('Configuración de Novo')});
  const panels={} as Record<SettingsSection,HTMLElement>;
  const buttons={} as Record<SettingsSection,HTMLButtonElement>;
  let selected=initial;
  for(const id of SETTINGS_SECTIONS){
    const button=h('button',{type:'button',id:`tab-${id}`,class:'settings-tab',role:'tab','aria-controls':`panel-${id}`,text:labels[id]});
    const panel=h('div',{id:`panel-${id}`,class:'settings-pane',role:'tabpanel','aria-labelledby':`tab-${id}`});
    buttons[id]=button;panels[id]=panel;nav.append(button);
    button.addEventListener('click',()=>show(id));
    button.addEventListener('keydown',event=>{
      const key=(event as KeyboardEvent).key;const index=SETTINGS_SECTIONS.indexOf(id);
      const next=key==='ArrowRight'?SETTINGS_SECTIONS[(index+1)%4]:key==='ArrowLeft'?SETTINGS_SECTIONS[(index+3)%4]:key==='Home'?'account':key==='End'?'desktop':null;
      if(next){event.preventDefault();show(next);buttons[next].focus();}
    });
  }
  function show(id:SettingsSection,notify=true){
    selected=id;
    for(const section of SETTINGS_SECTIONS){
      const active=section===id;panels[section].hidden=!active;
      buttons[section].setAttribute('aria-selected',String(active));buttons[section].tabIndex=active?0:-1;
    }
    if(notify)onChange(id);
  }
  show(initial,false);
  return {nav,panels,show,get selected(){return selected;}};
}
