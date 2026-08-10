import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  assertCleanMigrationTarget,
  verifyCleanMigrationChain,
} from '../verify-clean-migration-chain.mjs';

test('requires explicit clean migration confirmation', () => {
  assert.throws(
    () =>
      assertCleanMigrationTarget({
        confirmed: false,
        databaseUrl: 'postgresql://localhost/novo_clean_migration',
      }),
    /NOVO_CLEAN_MIGRATION_DB=true is required/,
  );
});

test('rejects a remote target unless it is explicitly disposable', () => {
  assert.throws(
    () =>
      assertCleanMigrationTarget({
        confirmed: true,
        databaseUrl: 'postgresql://prod.example/novo',
      }),
    /must be local or explicitly disposable/,
  );
});

test('accepts a confirmed local clean database', () => {
  assert.deepEqual(
    assertCleanMigrationTarget({
      confirmed: true,
      databaseUrl: 'postgresql://localhost/novo_clean_migration',
    }),
    { databaseName: 'novo_clean_migration' },
  );
});

test('rejects a local database whose name is not marked clean or disposable', () => {
  assert.throws(
    () =>
      assertCleanMigrationTarget({
        confirmed: true,
        databaseUrl: 'postgresql://localhost/novo',
      }),
    /database name must contain clean or disposable/,
  );
});

test('allows an explicitly disposable remote database', () => {
  assert.deepEqual(
    assertCleanMigrationTarget({
      confirmed: true,
      databaseUrl: 'postgresql://staging.example/novo_disposable',
      remoteDisposable: true,
    }),
    { databaseName: 'novo_disposable' },
  );
});

test('verifyCleanMigrationChain reports all successful Prisma exit codes', async () => {
  const invocations = [];
  const spawn = (command, args, options) => {
    invocations.push({ command, args, options });
    return { status: 0 };
  };

  const result = await verifyCleanMigrationChain({
    databaseUrl: 'postgresql://localhost/novo_clean_migration',
    confirmed: true,
    spawn,
    logger: () => {},
  });

  assert.deepEqual(result, { deploy: 0, status: 0, validate: 0 });
  assert.deepEqual(
    invocations.map(({ args }) => args),
    [
      ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      ['prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma'],
      ['prisma', 'validate', '--schema', 'prisma/schema.prisma'],
    ],
  );
  for (const invocation of invocations) {
    assert.equal(invocation.options.env.DATABASE_URL, 'postgresql://localhost/novo_clean_migration');
  }
});

test('verifyCleanMigrationChain stops at the first nonzero Prisma exit', async () => {
  const invocations = [];
  const spawn = (_command, args) => {
    invocations.push(args);
    return { status: 1 };
  };

  await assert.rejects(
    verifyCleanMigrationChain({
      databaseUrl: 'postgresql://localhost/novo_clean_migration',
      confirmed: true,
      spawn,
      logger: () => {},
    }),
    /prisma migrate deploy exited with code 1/,
  );
  assert.equal(invocations.length, 1);
});

test('bridge migration contains only the four additive Cognitive Twin tables', () => {
  const migration = readFileSync(
    new URL(
      '../../prisma/migrations/20260801115000_add_cognitive_twin_schema_bridge/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );

  assert.deepEqual(
    [...migration.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map((match) => match[1]),
    [
      'cognitive_twin_records',
      'behavioral_signals',
      'twin_evolution_logs',
      'twin_snapshots',
    ],
  );
  assert.equal((migration.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) ?? []).length, 9);
  assert.equal((migration.match(/EXCEPTION WHEN duplicate_object THEN NULL/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /^\s*(?:DROP|UPDATE)\b/im);
  assert.doesNotMatch(migration, /ALTER\s+TABLE\s+"[^"]+"[\s\S]{0,200}\bDROP\b/i);
});
