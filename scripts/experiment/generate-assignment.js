// scripts/experiment/generate-assignment.js
//
// Generates the pre-registered 28-day block-randomized REAL/CONTROL
// assignment for the interruption-frequency deep-work pilot, encrypts each
// day's condition with a single AES-256-GCM key generated here, and inserts
// the rows into experiment_days. The key is printed ONCE to the terminal and
// nowhere else — it is not written to any file in this repo, not logged to
// any service, and not retained by this script after it exits.
//
// Custody: print the key, physically write it down, seal it in an envelope,
// do not open it until Day 29. This does not defend against a fully
// motivated self-adversary with database access — its purpose is to remove
// casual/incidental temptation to check, and to create a real commitment
// device, exactly as discussed in the pre-registration.
//
// Usage: node scripts/experiment/generate-assignment.js <user-email> <start-date YYYY-MM-DD>

// Plain `node script.js` does not auto-load .env like `next dev` does —
// load it explicitly so DATABASE_URL is actually set before Prisma connects.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') })
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

const BLOCK_SIZE = 4 // 2 REAL + 2 CONTROL per block
const BLOCKS = 7 // 7 * 4 = 28 days
const TOTAL_DAYS = BLOCK_SIZE * BLOCKS

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    encryptedCondition: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

async function main() {
  const email = process.argv[2]
  const startDateArg = process.argv[3]

  if (!email || !startDateArg) {
    console.error('Usage: node scripts/experiment/generate-assignment.js <user-email> <start-date YYYY-MM-DD>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No user found with email ${email}`)
    process.exit(1)
  }

  const existing = await prisma.experimentDay.findFirst({ where: { userId: user.id } })
  if (existing) {
    console.error('An experiment assignment already exists for this user. Refusing to overwrite — delete existing experiment_days rows first if you really intend to regenerate.')
    process.exit(1)
  }

  const key = crypto.randomBytes(32) // AES-256 key, held only in memory here

  const startDate = new Date(startDateArg + 'T00:00:00Z')
  const rows = []
  let dayNumber = 1

  for (let block = 0; block < BLOCKS; block++) {
    const conditions = shuffle(['REAL', 'REAL', 'CONTROL', 'CONTROL'])
    for (let pos = 0; pos < BLOCK_SIZE; pos++) {
      const date = new Date(startDate)
      date.setUTCDate(date.getUTCDate() + (dayNumber - 1))

      const { encryptedCondition, iv, authTag } = encrypt(conditions[pos], key)

      rows.push({
        userId: user.id,
        date,
        dayNumber,
        blockIndex: block,
        positionInBlock: pos,
        encryptedCondition,
        iv,
        authTag,
      })
      dayNumber++
    }
  }

  await prisma.experimentDay.createMany({ data: rows })

  console.log(`Created ${rows.length} experiment days for ${email}, starting ${startDateArg}.`)
  console.log('')
  console.log('=== DECRYPTION KEY (base64) — write this down on paper NOW, then close this terminal ===')
  console.log(key.toString('base64'))
  console.log('=== Do not screenshot. Do not paste into a file. Seal it and do not open until Day 29. ===')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
