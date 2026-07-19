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
  // Without this, jest's haste map picks up the duplicate copy of every
  // module/test file from a leftover worktree and fails with mangled
  // cross-directory module resolution errors that look like real bugs.
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)