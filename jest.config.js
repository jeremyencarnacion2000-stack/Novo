const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Escape a filesystem path for safe embedding inside a RegExp source string.
// Needed because this repo's absolute path contains literal parentheses
// ("novo-desktop-mvp (2)") and, on Windows, backslash separators — both are
// regex metacharacters that silently change the pattern's meaning (or throw)
// if not escaped. Jest's own `<rootDir>` token substitution does exactly
// this substitution WITHOUT escaping, which is what made the two previous
// attempts at this same fix (8c7a94c, a242593) still not work.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Anchored to THIS run's own rootDir (the directory containing this config
// file), not an unanchored substring match. A bare `.claude/worktrees/`
// substring match excludes EVERY file whenever the test run itself is
// executed from inside a worktree checkout — which is the normal case for
// every agent session (cwd is already `.claude/worktrees/<agent-id>/`) and
// silently produced "No tests found" for all of them. Anchoring so the
// pattern only matches worktree copies NESTED under this run's own rootDir
// (the original problem: duplicate test files under
// `<rootDir>/.claude/worktrees/*` confusing jest's haste map when run from
// the main checkout) fixes that without reintroducing the duplicate-module
// bug the pattern was added for.
const rootDirEscaped = escapeRegExp(__dirname.replace(/\\/g, '/'))
const nestedWorktreePattern = `^${rootDirEscaped}[\\\\/].*[\\\\/]\\.claude[\\\\/]worktrees[\\\\/]`

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', nestedWorktreePattern],
  modulePathIgnorePatterns: [nestedWorktreePattern],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)