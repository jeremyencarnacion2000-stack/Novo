import {h} from '../views/dom';
import {t} from '../i18n/i18n';

export function novoSettingsHeader(version:string){
  const namespace='http://www.w3.org/2000/svg';
  const mark=document.createElementNS(namespace,'svg');
  mark.setAttribute('viewBox','0 0 64 64');mark.setAttribute('class','novo-settings-mark');mark.setAttribute('aria-hidden','true');
  for(const [name,attributes] of [
    ['circle',{cx:'32',cy:'32',r:'25',fill:'none',stroke:'currentColor','stroke-width':'1.4'}],
    ['path',{d:'M42 16a20 20 0 1 0 7 31A22 22 0 0 1 42 16Z',fill:'currentColor'}],
    ['circle',{cx:'18',cy:'19',r:'2',fill:'#e7c99b'}],
  ] as const){
    const element=document.createElementNS(namespace,name);
    for(const [attribute,value] of Object.entries(attributes))element.setAttribute(attribute,value);
    mark.append(element);
  }
  return h('header',{class:'settings-brand'},mark,h('div',{},h('h1',{text:'Novo'}),h('p',{text:t("Settings")})),h('span',{class:'version',text:version}));
}
