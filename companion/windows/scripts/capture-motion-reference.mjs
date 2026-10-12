import { writeFileSync, existsSync } from 'node:fs';
import { SCENARIOS, sampleMotion } from '../tests/helpers/motion-sampler.mjs';
import { REFERENCE_SHA } from '../tests/helpers/motion-reference-loader.mjs';

const target = new URL('../tests/fixtures/coucou-a7bd575-motion.json', import.meta.url);
if (existsSync(target)) throw new Error('The upstream oracle is frozen; refusing to overwrite it');
const scenarios = {};
for (const scenario of SCENARIOS) scenarios[scenario] = await sampleMotion('upstream', scenario);
writeFileSync(target, JSON.stringify({ source: REFERENCE_SHA, step: 1 / 60, random: 0.425, scenarios }));
console.log(`Frozen ${SCENARIOS.length} scenarios from ${REFERENCE_SHA}`);
