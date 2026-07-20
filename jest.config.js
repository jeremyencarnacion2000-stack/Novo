const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

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
  // Agent worktrees live under .claude/worktrees/ inside this same repo tree.
  // Without this, jest discovers and runs the duplicate copy of every test
  // file from a leftover worktree (as its own suite) AND its haste map picks
  // up duplicate modules, producing mangled cross-directory resolution
  // errors that look like real bugs. Deliberately NOT anchored with
  // <rootDir> - this repo's absolute path contains literal parentheses
  // ("novo-desktop-mvp (2)"), which <rootDir> interpolation turns into an
  // unintended regex capture group instead of literal text, silently
  // breaking the match. Matching the relative substring instead sidesteps
  // that entirely.
  testPathIgnorePatterns: ['/node_modules/', '[\\\\/]\\.claude[\\\\/]worktrees[\\\\/]'],
  modulePathIgnorePatterns: ['[\\\\/]\\.claude[\\\\/]worktrees[\\\\/]'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)