import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const file=process.env.NOVO_OIDC_TEST_STORE;
function rows(){return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];}
export const prisma={oAuthModel:{
  async upsert({where,create,update}){const items=rows(),{type,modelId}=where.type_modelId;const at=items.findIndex(x=>x.type===type&&x.modelId===modelId);const row=at<0?create:{...items[at],...update};if(at<0)items.push(row);else items[at]=row;writeFileSync(file,JSON.stringify(items));return row;},
  async findUnique({where}){const {type,modelId}=where.type_modelId;const r=rows().find(x=>x.type===type&&x.modelId===modelId);return r?{...r,expiresAt:r.expiresAt?new Date(r.expiresAt):null}:null;},
  async findFirst({where}){const r=rows().find(x=>Object.entries(where).every(([k,v])=>x[k]===v));return r?{...r,expiresAt:r.expiresAt?new Date(r.expiresAt):null}:null;},
}};
