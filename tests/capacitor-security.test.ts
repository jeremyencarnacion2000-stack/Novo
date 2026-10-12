import fs from 'node:fs'
import path from 'node:path'

describe('Capacitor security baseline', () => {
  it('does not bypass provider OAuth policies or permit mixed content', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'capacitor.config.ts'), 'utf8')

    expect(source).not.toContain('overrideUserAgent')
    expect(source).not.toContain('allowMixedContent: true')
    expect(source).toContain('CAPACITOR_SERVER_URL')
    expect(source).toContain("https://productivitynovo.vercel.app/app")
    expect(source).toContain('cleartext: false')
  })

  it('keeps generated native assets app-only and server-backed', () => {
    const nativeConfigs = [
      'android/app/src/main/assets/capacitor.config.json',
      'ios/App/App/capacitor.config.json',
    ]
    for (const relativePath of nativeConfigs) {
      const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')) as {
        webDir?: string
        server?: { url?: string; cleartext?: boolean }
      }
      expect(config.webDir).toBe('native-shell')
      expect(config.server?.url).toBe('https://productivitynovo.vercel.app/app')
      expect(config.server?.cleartext).toBe(false)
    }

    const fallback = fs.readFileSync(path.join(process.cwd(), 'native-shell/index.html'), 'utf8')
    expect(fallback).toContain('productivitynovo.vercel.app/app')
    expect(fallback).not.toContain('/landing')
  })

  it('starts installed web shells on the app surface, not acquisition', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8')) as {
      id?: string
      start_url?: string
    }
    expect(manifest.id).toBe('/app')
    expect(manifest.start_url).toBe('/app')
  })
})
