import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

const root = process.cwd()
const sourceRoots = ['app', 'components', 'hooks', 'lib']
const files = []

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(fullPath)
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(fullPath)
  }
}

for (const sourceRoot of sourceRoots) walk(path.join(root, sourceRoot))

const candidates = new Set()
const classAttribute = /(?:className|class)\s*=\s*(?:\{?\s*)?["'`]([\s\S]*?)["'`]/g
const utilityLike = /^(?:!?[a-z0-9\[\]./%#(),:+_\-]+:)*!?[a-z0-9\[\]./%#(),:+_\-]+$/i

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(classAttribute)) {
    for (const rawToken of match[1].split(/\s+/)) {
      const token = rawToken.trim()
      if (token && utilityLike.test(token) && !token.includes('${')) candidates.add(token)
    }
  }
}

const sorted = [...candidates].sort()
const chunks = []
for (let index = 0; index < sorted.length; index += 350) {
  const chunk = sorted.slice(index, index + 350)
    .map((token) => token.replaceAll('\\', '\\\\').replaceAll('"', '\\"'))
    .join(' ')
  chunks.push(`@source inline("${chunk}");`)
}

const output = `/* Generated before Next/Tailwind production builds. */\n${chunks.join('\n')}\n`
const sourcePath = path.join(root, 'app', 'tailwind-source.css')
fs.writeFileSync(sourcePath, output)

// Android WebView versions still used by some devices do not understand CSS
// cascade layers. Tailwind v4 emits its utilities inside @layer blocks, which
// makes those browsers silently discard the responsive utility rules. Build a
// compatibility sheet by flattening the generated layers while keeping media
// queries and the original declaration order intact.
function flattenLayers(css) {
  const root = postcss.parse(css)
  let layers = []
  do {
    layers = []
    root.walkAtRules('layer', (layer) => layers.push(layer))
    for (const layer of layers) {
      if (!layer.nodes) {
        layer.remove()
      } else {
        layer.replaceWith(...layer.nodes.map((child) => child.clone()))
      }
    }
  } while (layers.length > 0)
  return root.toString()
}

function flattenNestedMedia(css) {
  const root = postcss.parse(css)

  root.walkAtRules('media', (media) => {
    if (media.parent?.type !== 'rule') return

    const parent = media.parent
    const params = media.params.replace(/\(width\s*>=\s*([^\)]+)\)/g, '(min-width:$1)')
      .replace(/\(width\s*<=\s*([^\)]+)\)/g, '(max-width:$1)')
    const rule = postcss.rule({ selector: parent.selector })
    rule.append(media.nodes)
    const wrapper = postcss.atRule({ name: 'media', params })
    wrapper.append(rule)
    parent.parent.insertAfter(parent, wrapper)
    media.remove()
    if (parent.nodes.length === 0) parent.remove()
  })

  return root.toString()
}

const globalsPath = path.join(root, 'app', 'globals.css')
const globalsSource = fs.readFileSync(globalsPath, 'utf8')
  .replace(/@import\s+['"]\.\/tailwind-legacy\.css['"];?\s*/g, '')
const rendered = await postcss([tailwindcss()]).process(globalsSource, { from: globalsPath })
const legacyCss = flattenNestedMedia(flattenLayers(rendered.css))
const legacy = `/* Generated for legacy WebViews that cannot parse CSS cascade layers or nested media. */\n${legacyCss}\n`
fs.writeFileSync(path.join(root, 'app', 'tailwind-legacy.css'), legacy)
console.log(`Tailwind source candidates: ${sorted.length}`)
