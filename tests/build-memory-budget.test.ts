import fs from 'node:fs'
import path from 'node:path'

describe('production build memory budget', () => {
  it('gives every Next production build enough heap for the project typecheck worker', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    const buildWrapper = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'next-build.mjs'),
      'utf8',
    )

    expect(buildWrapper).toContain('--max-old-space-size=4096')
    expect(buildWrapper).toContain('next/dist/bin/next')

    for (const scriptName of ['build', 'build:cap', 'vercel-build']) {
      expect(pkg.scripts[scriptName]).toContain('scripts/next-build.mjs')
      expect(pkg.scripts[scriptName]).toContain('build')
      expect(pkg.scripts[scriptName]).toContain('--webpack')
    }
  })
})
