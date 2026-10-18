import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8')
  .split('/* Regular navigation glass:')[1]
const themeBlocks = [css.match(/:root\s*\{([^}]+)\}/)![1], css.match(/\.dark\s*\{([^}]+)\}/)![1]]
const token = (block: string, name: string) => block.match(new RegExp(`--novo-navigation-${name}:\\s*([^;]+);`))![1]
const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
const rgba = (value: string) => value.match(/[\d.]+/g)!.map(Number)
const blend = (front: number[], back: number[], alpha: number) => back.map((channel, i) => front[i] * alpha + channel * (1 - alpha))
const luminance = (color: number[]) => color.map(channel => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)

describe('regular navigation contrast bounds', () => {
  it.each(themeBlocks.map((block, i) => [i ? 'dark' : 'light', block]))(
    'keeps %s navigation labels legible at both backdrop extremes', (_theme, block) => {
      for (const material of ['tint', 'panel-tint']) {
        const [r, g, b, alpha] = rgba(token(block, material))
        const selection = rgba(token(block, 'selection'))
        for (const backdrop of [[0, 0, 0], [255, 255, 255]]) {
          const surface = blend([r, g, b], backdrop, alpha)
          const selected = blend(selection, surface, selection[3])
          for (const foreground of ['foreground', 'secondary']) {
            expect(contrast(rgb(token(block, foreground)), surface)).toBeGreaterThanOrEqual(4.5)
            expect(contrast(rgb(token(block, foreground)), selected)).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    },
  )
})
