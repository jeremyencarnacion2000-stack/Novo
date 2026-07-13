// lib/experiment/crypto.ts
//
// AES-256-GCM decrypt for the daily experiment condition. The key lives only
// in the EXPERIMENT_DECRYPTION_KEY environment variable set once at
// generation time (see scripts/experiment/generate-assignment.js) — it is
// never sent to the client and this module never logs a decrypted value.
//
// Honest limitation: this does not defend against the account owner reading
// their own Vercel environment variables. Its purpose is to prevent
// *incidental* discovery (e.g. glancing at a database row) and to serve as a
// commitment device alongside the physical envelope — not as
// adversarial-proof security against oneself. See the pilot pre-registration.

import crypto from 'crypto'

export type ExperimentCondition = 'REAL' | 'CONTROL'

export function decryptCondition(encryptedCondition: string, iv: string, authTag: string): ExperimentCondition {
  const keyB64 = process.env.EXPERIMENT_DECRYPTION_KEY
  if (!keyB64) {
    throw new Error('EXPERIMENT_DECRYPTION_KEY is not set — cannot decrypt today\'s condition')
  }
  const key = Buffer.from(keyB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedCondition, 'base64')),
    decipher.final(),
  ])
  const value = decrypted.toString('utf8')
  if (value !== 'REAL' && value !== 'CONTROL') {
    throw new Error('Decrypted condition is not REAL or CONTROL — data corruption')
  }
  return value
}
