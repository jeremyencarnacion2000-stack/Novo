const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Escape a single path segment for safe embedding inside a RegExp source
// string (this repo's absolute path contains literal parentheses -
// "novo-desktop-mvp (2)" - a regex metacharacter that silently changes the
// pattern's meaning if not escaped).
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Anchored to THIS run's own rootDir (the directory containing this config
// file), not an unanchored substring match. A bare `.claude/worktrees/`
// substring match excludes EVERY file whenever the test run itself is
// executed from inside a worktree checkout - which is the normal case for
// every agent session (cwd is already `.claude/worktrees/<agent-id>/`) and
// silently produced "No tests found" for all of them (bug #1, fixed in
// 6993972). Anchoring so the pattern only matches worktree copies NESTED
// under this run's own rootDir fixes that without reintroducing the
// duplicate-module bug the pattern was added for in the first place.
//
// Built by splitting rootDir into segments and escaping/rejoining with a
// [\\/] class, rather than normalizing to one separator style and escaping
// the whole string at once (bug #2: that version required a literal `/`
// immediately after rootDir - true when this run's OWN path happens to use
// forward slashes - but Windows absolute paths use backslashes, so the
// anchor itself silently never matched and the exclusion was a no-op).
// Also: the segment between rootDir and `.claude/worktrees/` was previously
// mandatory (`[\\/].*[\\/]`), which requires an intermediate path segment -
// but when running from the main tree, `.claude/worktrees/` sits directly
// under rootDir with nothing between them, so that never matched either.
// Made optional via `(?:.*[\\/])?` to cover both the direct case and a
// worktree-containing-a-worktree case.
const rootDirSegments = __dirname.split(/[\\/]/).map(escapeRegExp)
const rootDirPattern = rootDirSegments.join('[\\\\/]')
const nestedWorktreePattern = `^${rootDirPattern}[\\\\/](?:.*[\\\\/])?\\.claude[\\\\/]worktrees[\\\\/]`

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Jest's empty export-condition set cannot resolve Prisma's package
    // export map; point the isolated DB runner at its generated entrypoint.
    '^@prisma/client$': '<rootDir>/node_modules/@prisma/client/default.js',
    '^uuid$': '<rootDir>/tests/mocks/uuid.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(msw|@mswjs|uuid)/)'],
  testPathIgnorePatterns: ['/node_modules/', nestedWorktreePattern, '/\\.kilo\\/worktrees\\/'],
  modulePathIgnorePatterns: [nestedWorktreePattern, '\\.kilo\\worktrees'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
