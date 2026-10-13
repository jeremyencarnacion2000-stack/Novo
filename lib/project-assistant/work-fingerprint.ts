import {createHash} from 'node:crypto'
export const workFingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
