// Account conversation state only: no poses, provider credentials or file context.
export type NovoAccountState = 'demo'|'authorization_pending'|'verifying'|'connected'|'offline'|'permission_required'|'expired'|'revoked';
export interface NovoAuthorization {
  version: 1; state: string; user: {id:string;displayName:string|null};
  device: {id:string;name:string;platform:string;connectedAt:string;lastVerifiedAt:string;revokedAt:string|null;scopes:string[]}|null;
  capabilities: {deviceConnect:boolean;aiChat:boolean;twinRead:boolean;integrationsRead:boolean;activityRead:boolean;activityWrite:boolean;workContextRead:boolean;workContextWrite:boolean};
}
export interface NativeAccountStatus {state:NovoAccountState;authorization:NovoAuthorization|null;lastVerifiedAt:string|null;revocationPending:boolean}
export interface NovoChatModel {id:string;label:string;allowsTwinMode:boolean}
export interface ConversationSummary {id:string;title:string;updatedAt:string;revision:number}
export interface AccountConversation extends ConversationSummary {messages:{id:string;role:'user'|'assistant'|'system';content:string;timestamp:string}[]}
export interface ProjectHint {source:'folder'|'github'|'vercel';name:string;repository?:string;vercelProjectId?:string}
export interface NovoLocalContext {text:string;folders:string[];matchedFiles:number;projectHints?:ProjectHint[];connections?:{github?:string;vercel?:string;codex?:string}}
export interface CompanionChatRequest {requestId:string;conversationId:string|null;conversationRevision:number|null;message:string;model:string;twinMode:boolean;localContext?:string;projectHints?:ProjectHint[];localConnections?:NovoLocalContext['connections']}
export type CompanionChatEvent =
  | {type:'metadata';requestId:string;conversationId:string;revision:number;userMessageId:string}
  | {type:'phase';requestId:string;phase:string}
  | {type:'delta';requestId:string;text:string}
  | {type:'complete';requestId:string;assistantMessageId:string;revision:number;modelId:string}
  | {type:'error';requestId:string;code:string;message:string};
export interface NovoSafeError {code:string;message:string;retryAfterSeconds?:number|null}
const errors:Record<string,string> = {
  demo:'Conecta tu cuenta de Novo para conversar.',offline:'Sin conexión. Tu credencial se conserva.',
  expired:'Vuelve a autorizar este dispositivo.',revoked:'Esta conexión fue revocada en Novo.',
  permission_required:'Actualiza los permisos de esta conexión.',chat_disabled:'El chat aún no está activado en este servidor.',
  turn_active:'Ya hay un turno en curso.',pending:'La solicitud ya está en curso. No se inició otra generación.',
  request_conflict:'La solicitud tiene un conflicto. No se repitió la generación.',revision_conflict:'La conversación cambió. Ábrela de nuevo antes de enviar.',
  rate_limited:'Límite temporal. Espera antes de enviar otro mensaje.',stream_interrupted:'Respuesta interrumpida. No se reintentó automáticamente.',
  cancelled:'Solicitud cancelada.',invalid_request:'Comprueba el mensaje, el modelo y los permisos.',
  request_expired:'Esta solicitud antigua no se puede regenerar automáticamente.',revocation_pending:'Detenido localmente; revocación remota pendiente.',
  unavailable:'Novo no está disponible. No se reintentó la generación.',
};
export function safeNovoError(value:unknown):NovoSafeError {
  const object=value && typeof value==='object' ? value as Record<string,unknown> : {};
  const code=typeof object.code==='string' && Object.hasOwn(errors,object.code) ? object.code : 'unavailable';
  const retry=typeof object.retryAfterSeconds==='number' && Number.isFinite(object.retryAfterSeconds) ? Math.min(3600,Math.max(1,object.retryAfterSeconds)) : null;
  return {code,message:errors[code],retryAfterSeconds:retry};
}
export function accountLabel(account:NativeAccountStatus|null):string {
  return ({demo:'Demostración',authorization_pending:'Autorización pendiente',verifying:'Verificando cuenta',connected:'Cuenta conectada',offline:'Sin conexión',permission_required:'Permisos necesarios',expired:'Sesión vencida',revoked:'Conexión revocada'} satisfies Record<NovoAccountState,string>)[account?.state ?? 'demo'];
}
export interface NovoChatApi {
  novoAccountStatus():Promise<NativeAccountStatus>;
  novoChatModels():Promise<NovoChatModel[]>;
  novoConversations():Promise<ConversationSummary[]>;
  novoConversationGet(id:string):Promise<AccountConversation>;
  novoChatStart(input:CompanionChatRequest):Promise<void>;
  novoChatCancel(requestId:string):Promise<void>;
  contextSearch?(query:string):Promise<NovoLocalContext>;
}
type Subscription = <T>(name:string,callback:(value:T)=>void)=>Promise<()=>void>;
export interface NovoChatState {
  account:NativeAccountStatus|null;models:NovoChatModel[];conversations:ConversationSummary[];
  conversation:AccountConversation|null;activeRequestId:string|null;liveText:string;pendingMessage:string;
  contextFilesUsed:number;
  phase:'idle'|'loading'|'thinking'|'streaming';error:NovoSafeError|null;
}
export class NovoChatController {
  readonly state:NovoChatState={account:null,models:[],conversations:[],conversation:null,activeRequestId:null,liveText:'',pendingMessage:'',contextFilesUsed:0,phase:'idle',error:null};
  private api:NovoChatApi;private changed:()=>void;private generation=0;private selection=0;
  private disposed=false;private unlisten:(()=>void)[]=[];private cooldownUntil=0;
  private metadata:Extract<CompanionChatEvent,{type:'metadata'}>|null=null;
  private terminal:Extract<CompanionChatEvent,{type:'complete'}>|null=null;
  private streamError:NovoSafeError|null=null;
  private ready:Promise<void>;
  private accountRetry:ReturnType<typeof setTimeout>|null=null;
  constructor(api:NovoChatApi,subscribe:Subscription,changed:()=>void) {
    this.api=api;this.changed=changed;
    const save=(stop:()=>void)=>{if(this.disposed)stop();else this.unlisten.push(stop);};
    this.ready=Promise.all([
      subscribe<CompanionChatEvent>('novo-chat-event',event=>this.onEvent(event)).then(save),
      subscribe<null>('novo-account-changed',()=>{this.resetAccount();void this.loadAccount();}).then(save),
    ]).then(()=>{}).catch(()=>{this.state.error=safeNovoError(null);this.notify();});
  }
  get canSend():boolean {
    return !this.disposed && this.state.account?.state==='connected' && !this.state.account.revocationPending
      && this.state.account.authorization?.capabilities.aiChat===true && this.state.phase==='idle'
      && this.state.models.length>0 && Date.now()>=this.cooldownUntil;
  }
  private notify(){if(!this.disposed)this.changed();}
  private isCurrent(generation:number){return !this.disposed && generation===this.generation;}
  private resetAccount(){
    if(this.accountRetry!==null){clearTimeout(this.accountRetry);this.accountRetry=null;}
    const request=this.state.activeRequestId;++this.generation;++this.selection;
    Object.assign(this.state,{account:null,models:[],conversations:[],conversation:null,activeRequestId:null,liveText:'',pendingMessage:'',phase:'idle',error:null});
    this.metadata=null;this.terminal=null;this.streamError=null;this.cooldownUntil=0;
    if(request)void this.api.novoChatCancel(request).catch(()=>{});
    this.notify();
  }
  async loadAccount():Promise<void> {
    await this.ready;if(this.disposed || this.state.activeRequestId)return;
    if(this.accountRetry!==null){clearTimeout(this.accountRetry);this.accountRetry=null;}
    const generation=++this.generation;this.state.phase='loading';this.state.error=null;this.notify();
    try {
      const account=await this.api.novoAccountStatus();if(!this.isCurrent(generation))return;
      const previous=this.state.account?.authorization?.user.id;
      if(previous && previous!==account.authorization?.user.id){this.state.conversation=null;this.state.liveText='';}
      this.state.account=account;this.state.models=[];this.state.conversations=[];
      if(account.state==='connected' && !account.revocationPending && account.authorization?.capabilities.aiChat){
        const [models,conversations]=await Promise.all([this.api.novoChatModels(),this.api.novoConversations()]);
        if(!this.isCurrent(generation))return;this.state.models=models;this.state.conversations=conversations;
      } else {this.state.conversation=null;}
    } catch(error){if(this.isCurrent(generation))this.state.error=safeNovoError(error);}
    finally {if(this.isCurrent(generation)){
      this.state.phase='idle';this.notify();
      if(this.state.account?.state==='offline')this.accountRetry=setTimeout(()=>{this.accountRetry=null;void this.loadAccount();},60_000);
    }}
  }
  async selectConversation(id:string):Promise<void> {
    if(this.disposed || this.state.activeRequestId)return;
    const generation=this.generation;const selection=++this.selection;
    this.state.error=null;this.state.phase='loading';this.state.conversation=null;this.state.liveText='';this.notify();
    try {
      if(!id)return;
      const conversation=await this.api.novoConversationGet(id);
      if(this.isCurrent(generation) && selection===this.selection)this.state.conversation=conversation;
    } catch(error){if(this.isCurrent(generation)&&selection===this.selection)this.state.error=safeNovoError(error);}
    finally {if(this.isCurrent(generation)&&selection===this.selection){this.state.phase='idle';this.notify();}}
  }
  private onEvent(event:CompanionChatEvent){
    if(this.disposed || !event || event.requestId!==this.state.activeRequestId)return;
    switch(event.type){
      case 'metadata':this.metadata=event;break;
      case 'phase':this.state.phase='thinking';break;
      case 'delta':this.state.liveText+=event.text;this.state.phase='streaming';break;
      case 'complete':this.terminal=event;break;
      case 'error':this.streamError=safeNovoError(event);this.state.error=this.streamError;break;
    }
    this.notify();
  }
  private streamResult(){return {metadata:this.metadata,terminal:this.terminal,error:this.streamError};}
  async send(message:string,model:string,twinMode:boolean):Promise<void> {
    await this.ready;
    if(!this.canSend)return;
    const choice=this.state.models.find(candidate=>candidate.id===model);
    if(!message.trim() || Array.from(message).length>12000 || !choice || (twinMode && (!choice.allowsTwinMode || !this.state.account?.authorization?.capabilities.twinRead))){this.state.error=safeNovoError({code:'invalid_request'});this.notify();return;}
    const generation=this.generation;const requestId=crypto.randomUUID();
    const conversation=this.state.conversation;
    const input:CompanionChatRequest={requestId,conversationId:conversation?.id??null,conversationRevision:conversation?.revision??null,message:message.trim(),model,twinMode};
    this.state.activeRequestId=requestId;this.state.pendingMessage=input.message;this.state.liveText='';this.state.error=null;this.state.phase='thinking';
    this.state.contextFilesUsed=0;
    this.metadata=null;this.terminal=null;this.streamError=null;this.notify();
    try {
      if(this.api.contextSearch){
        try {
          const context=await this.api.contextSearch(input.message);
          if(!this.isCurrent(generation))return;
          input.localContext=context.text || undefined;
          input.projectHints=context.projectHints;
          input.localConnections=context.connections;
          this.state.contextFilesUsed=context.matchedFiles;
          this.notify();
        } catch { /* A local scan failure must not prevent the chat from helping. */ }
      }
      if(!this.isCurrent(generation))return;
      await this.api.novoChatStart(input);if(!this.isCurrent(generation))return;
      const result=this.streamResult();
      if(result.error)throw result.error;
      if(!result.terminal || !result.metadata)throw {code:'stream_interrupted'};
      const saved=await this.api.novoConversationGet(result.metadata.conversationId);
      if(!this.isCurrent(generation))return;
      this.state.conversation=saved;this.state.pendingMessage='';this.state.liveText='';
      const list=await this.api.novoConversations();if(this.isCurrent(generation))this.state.conversations=list;
    } catch(error){
      if(!this.isCurrent(generation))return;this.state.error=safeNovoError(error);
      if(['expired','revoked','permission_required'].includes(this.state.error.code)){
        this.state.account={state:this.state.error.code as NovoAccountState,authorization:null,lastVerifiedAt:null,revocationPending:false};
        this.state.models=[];this.state.conversations=[];this.state.conversation=null;this.state.liveText='';this.state.pendingMessage='';
      }
      if(this.state.error.retryAfterSeconds)this.cooldownUntil=Date.now()+this.state.error.retryAfterSeconds*1000;
    } finally {
      if(this.isCurrent(generation)){this.state.activeRequestId=null;this.state.phase='idle';this.notify();}
    }
  }
  async cancel():Promise<void> {
    const request=this.state.activeRequestId;if(!request)return;
    const generation=this.generation;this.streamError=safeNovoError({code:'cancelled'});
    try {await this.api.novoChatCancel(request);}
    catch(error){if(this.isCurrent(generation))this.state.error=safeNovoError(error);}
    this.notify();
  }
  dispose():void {
    if(this.disposed)return;this.resetAccount();this.disposed=true;for(const stop of this.unlisten)stop();this.unlisten=[];
  }
}
