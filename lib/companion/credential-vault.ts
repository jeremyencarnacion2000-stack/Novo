import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'novo:v1:'
const KEY_LENGTH = 32
const IV_LENGTH = 12

export type IntegrationCredentialContext = { userId: string; provider: string }

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('credential_storage_unavailable')
  return createHash('sha256').update(`novo:integration-credential:v1:${secret}`).digest().subarray(0, KEY_LENGTH)
}

function associatedData(context: IntegrationCredentialContext): Buffer {
  return Buffer.from(`novo:integration:${context.provider}:${context.userId}:v1`, 'utf8')
}

export function encryptIntegrationCredential(value: string, context: IntegrationCredentialContext): string {
  if (!value || !context.userId || !context.provider) throw new Error('credential_storage_unavailable')
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(associatedData(context))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptIntegrationCredential(value: string, context: IntegrationCredentialContext): string {
  if (!value.startsWith(PREFIX)) throw new Error('credential_decryption_failed')
  const [ivValue, tagValue, ciphertextValue, extra] = value.slice(PREFIX.length).split('.')
  if (!ivValue || !tagValue || !ciphertextValue || extra !== undefined) throw new Error('credential_decryption_failed')

  try {
    const iv = Buffer.from(ivValue, 'base64url')
    const tag = Buffer.from(tagValue, 'base64url')
    if (iv.length !== IV_LENGTH || tag.length !== 16) throw new Error('credential_decryption_failed')
    const decipher = createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAAD(associatedData(context))
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('credential_decryption_failed')
  }
}

/** Read encrypted credentials while keeping pre-vault plaintext records compatible. */
export function resolveIntegrationCredential(value: string, context: IntegrationCredentialContext): string {
  if (value.startsWith(PREFIX)) return decryptIntegrationCredential(value, context)
  if (!value || value.startsWith('novo:')) throw new Error('credential_decryption_failed')
  return value
}
