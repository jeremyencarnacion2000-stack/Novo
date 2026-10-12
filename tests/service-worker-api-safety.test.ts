import fs from 'node:fs'
import path from 'node:path'

const serviceWorker = () =>
  fs.readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8').replace(/\r\n/g, '\n')

describe('service worker API privacy policy', () => {
  it('never places authenticated API responses in the browser-wide CacheStorage', () => {
    const source = serviceWorker()

    expect(source).toMatch(/url\.pathname\.startsWith\([\"']\/api\/[\"']\)/)
    expect(source).toContain('return; // no respondWith → default browser network fetch')
    expect(source).not.toContain('caches.open(API_CACHE_NAME)')
  })

  it('does not send non-http schemes to CacheStorage', () => {
    const source = serviceWorker()

    expect(source).toMatch(/url\.protocol !== [\"']http:[\"'] && url\.protocol !== [\"']https:[\"']/)
  })
})