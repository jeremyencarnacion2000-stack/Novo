import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertCleanMigrationTarget({
  confirmed,
  databaseUrl,
  remoteDisposable = process.env.NOVO_CLEAN_MIGRATION_REMOTE_DISPOSABLE === 'true',
}) {
  if (confirmed !== true) {
    throw new Error('NOVO_CLEAN_MIGRATION_DB=true is required');
  }

  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL_CLEAN_MIGRATION is required');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL_CLEAN_MIGRATION must be a valid PostgreSQL URL');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('DATABASE_URL_CLEAN_MIGRATION must be a valid PostgreSQL URL');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!LOCAL_HOSTS.has(hostname) && remoteDisposable !== true) {
    throw new Error('clean migration target must be local or explicitly disposable');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!/(clean|disposable)/i.test(databaseName)) {
    throw new Error('database name must contain clean or disposable');
  }

  return { databaseName };
}

export async function verifyCleanMigrationChain({
  databaseUrl,
  confirmed,
  remoteDisposable = process.env.NOVO_CLEAN_MIGRATION_REMOTE_DISPOSABLE === 'true',
  spawn = spawnSync,
  logger = console.log,
}) {
  assertCleanMigrationTarget({ confirmed, databaseUrl, remoteDisposable });

  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const commands = [
    {
      key: 'deploy',
      name: 'prisma migrate deploy',
      args: ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    },
    {
      key: 'status',
      name: 'prisma migrate status',
      args: ['prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma'],
    },
    {
      key: 'validate',
      name: 'prisma validate',
      args: ['prisma', 'validate', '--schema', 'prisma/schema.prisma'],
    },
  ];
  const exitCodes = {};

  for (const command of commands) {
    const result = spawn(executable, command.args, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    const exitCode = result.status ?? 1;
    exitCodes[command.key] = exitCode;
    logger(`${command.name}: ${exitCode}`);

    if (result.error) {
      throw new Error(`${command.name} could not start: ${result.error.message}`);
    }
    if (exitCode !== 0) {
      throw new Error(`${command.name} exited with code ${exitCode}`);
    }
  }

  return exitCodes;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    await verifyCleanMigrationChain({
      databaseUrl: process.env.DATABASE_URL_CLEAN_MIGRATION,
      confirmed: process.env.NOVO_CLEAN_MIGRATION_DB === 'true',
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
