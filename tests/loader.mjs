import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
const SRC = new URL('../src/', import.meta.url).pathname
const HERE = new URL('./', import.meta.url)
const MOCKS = {
  'next/cache': new URL('mock-next.ts', HERE).href,
  'next/navigation': new URL('mock-next.ts', HERE).href,
}
export async function resolve(spec, ctx, next) {
  if (MOCKS[spec]) return { url: MOCKS[spec], shortCircuit: true }
  if (ctx.parentURL?.startsWith(new URL('../src/lib/supabase/', import.meta.url).href) && (spec === './server' || spec === './admin'))
    return { url: new URL('mock-supabase.ts', HERE).href, shortCircuit: true }
  let path = null
  if (spec.startsWith('@/')) path = SRC + spec.slice(2)
  else if (spec.startsWith('.') && ctx.parentURL?.startsWith(new URL('../src/', import.meta.url).href)) path = new URL(spec, ctx.parentURL).pathname
  if (path && !path.endsWith('.ts')) {
    for (const c of [path + '.ts', path + '/index.ts']) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }
  }
  return next(spec, ctx)
}
