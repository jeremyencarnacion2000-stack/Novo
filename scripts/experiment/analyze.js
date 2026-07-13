// scripts/experiment/analyze.js
//
// Run ONLY after Day 28, once the physical envelope is opened.
// Decrypts each day's condition, computes the primary metric (completed
// high-priority tasks inside that day's displayed window) from existing
// Task data, and runs a permutation test that respects the actual
// block-randomization scheme used at generation time (2 REAL + 2 CONTROL
// per 4-day block) — this is the correct significance test for this design,
// not a plain t-test, because days are not independent draws.
//
// Success criteria (pre-registered):
//   (mean(REAL) - mean(CONTROL)) / mean(CONTROL) * 100 >= 15
//   AND permutation p-value < 0.10
//
// Usage: node scripts/experiment/analyze.js <user-email> <base64-key>

// Plain `node script.js` does not auto-load .env like `next dev` does —
// load it explicitly so DATABASE_URL is actually set before Prisma connects.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') })
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()
const PERMUTATIONS = 10000

function decrypt(encryptedCondition, iv, authTag, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedCondition, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

async function primaryMetricForDay(userId, windowStart, windowEnd) {
  return prisma.task.count({
    where: {
      userId,
      priority: 'high',
      status: 'done',
      updatedAt: { gte: windowStart, lt: windowEnd },
    },
  })
}

async function main() {
  const email = process.argv[2]
  const keyB64 = process.argv[3]

  if (!email || !keyB64) {
    console.error('Usage: node scripts/experiment/analyze.js <user-email> <base64-key>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) { console.error('User not found'); process.exit(1) }

  const key = Buffer.from(keyB64, 'base64')

  const days = await prisma.experimentDay.findMany({
    where: { userId: user.id },
    orderBy: { dayNumber: 'asc' },
  })

  if (days.length === 0) { console.error('No experiment days found'); process.exit(1) }

  const incomplete = days.filter((d) => !d.displayedWindowStart || !d.displayedWindowEnd)
  if (incomplete.length > 0) {
    console.warn(`WARNING: ${incomplete.length} day(s) never had a window generated (app wasn't opened that day) — excluded from analysis.`)
  }

  const results = []
  for (const day of days) {
    if (!day.displayedWindowStart || !day.displayedWindowEnd) continue
    const condition = decrypt(day.encryptedCondition, day.iv, day.authTag, key)
    const metric = await primaryMetricForDay(user.id, day.displayedWindowStart, day.displayedWindowEnd)
    results.push({ dayNumber: day.dayNumber, blockIndex: day.blockIndex, condition, metric, id: day.id })

    await prisma.experimentDay.update({
      where: { id: day.id },
      data: { revealedCondition: condition, revealedAt: new Date() },
    })
  }

  const realValues = results.filter((r) => r.condition === 'REAL').map((r) => r.metric)
  const controlValues = results.filter((r) => r.condition === 'CONTROL').map((r) => r.metric)

  const realMean = mean(realValues)
  const controlMean = mean(controlValues)
  const observedDiff = realMean - controlMean
  const pctImprovement = controlMean > 0 ? (observedDiff / controlMean) * 100 : (realMean > 0 ? Infinity : 0)

  // Permutation test respecting the block structure: within each block,
  // randomly relabel which 2 of the 4 days are "REAL" vs "CONTROL",
  // recompute the mean difference, and see how often the random relabeling
  // beats the observed difference.
  const blocks = {}
  for (const r of results) {
    if (!blocks[r.blockIndex]) blocks[r.blockIndex] = []
    blocks[r.blockIndex].push(r.metric)
  }
  const blockArrays = Object.values(blocks)

  let countExceeding = 0
  for (let p = 0; p < PERMUTATIONS; p++) {
    const permReal = []
    const permControl = []
    for (const blockMetrics of blockArrays) {
      const shuffled = shuffle(blockMetrics)
      const half = Math.floor(shuffled.length / 2)
      permReal.push(...shuffled.slice(0, half))
      permControl.push(...shuffled.slice(half))
    }
    const permDiff = mean(permReal) - mean(permControl)
    if (permDiff >= observedDiff) countExceeding++
  }
  const pValue = countExceeding / PERMUTATIONS

  const success = pctImprovement >= 15 && pValue < 0.10

  console.log('=== Novo Behavioral Pilot — Results ===')
  console.log(`Days analyzed: ${results.length} (REAL: ${realValues.length}, CONTROL: ${controlValues.length})`)
  console.log(`Mean completed high-priority tasks in window — REAL: ${realMean.toFixed(2)}, CONTROL: ${controlMean.toFixed(2)}`)
  console.log(`% improvement (REAL vs CONTROL): ${pctImprovement.toFixed(1)}%`)
  console.log(`Permutation test p-value: ${pValue.toFixed(4)} (${PERMUTATIONS} permutations, block-respecting)`)
  console.log('')
  console.log(`Success criteria: >=15% improvement AND p < 0.10`)
  console.log(success ? '>>> PILOT RESULT: POSITIVE — expand to 3-5 external participants within 7 days, no polish phase.' : '>>> PILOT RESULT: NEGATIVE — behavioral telemetry alone is insufficient. Evaluate physiological integrations.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
