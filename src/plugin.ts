import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { HTMLElement, parse } from 'node-html-parser'
import { resolve } from 'path'
import { Options } from './types'

const DEFAULT_OPTIONS: Required<Options> = {
  algorithm: 'sha256',
  charset: 'utf8' as BufferEncoding
}

function isExternalUrl(url: string): boolean {
  return /^(https?:)?\/\//.test(url)
}

export function sri(userOptions: Options = DEFAULT_OPTIONS) {
  const pluginOptions = { ...DEFAULT_OPTIONS, ...userOptions }

  return {
    name: 'vite-plugin-sri',
    apply: 'build',
    enforce: 'post',
    async writeBundle(options, bundle) {
      const outputDir = options.dir ? options.dir : 'dist'
      const htmlFiles = Object.keys(bundle).filter((file) => file.endsWith('.html'))

      await Promise.all(
        htmlFiles.map(async (file) => {
          const filePath = resolve(outputDir, file)
          let html = ''
          try {
            html = readFileSync(filePath, pluginOptions.charset)
          } catch (err) {
            console.error(`Error reading HTML file: ${filePath}`, err)
            return
          }

          const root = parse(html)

          await Promise.all(
            root.querySelectorAll('script[src], link[href]').map(async (element: HTMLElement) => {
              const srcOrHref = element.getAttribute('src') || element.getAttribute('href')
              if (!srcOrHref) return

              let fileBuffer: Buffer | null = null

              if (isExternalUrl(srcOrHref)) {
                try {
                  const response = await fetch(srcOrHref)
                  if (!response.ok) throw new Error(`Failed to fetch: ${srcOrHref}`)
                  const arrayBuffer = await response.arrayBuffer()
                  fileBuffer = Buffer.from(arrayBuffer)
                } catch (err) {
                  console.error(`Error fetching external resource: ${srcOrHref}`, err)
                  return
                }
              } else {
                const resolvedFilePath = resolve(outputDir, srcOrHref)
                try {
                  fileBuffer = readFileSync(resolvedFilePath)
                } catch (err) {
                  console.error(`Error reading local asset file: ${resolvedFilePath}`, err)
                  return
                }
              }

              if (fileBuffer) {
                if (element.tagName === 'LINK') {
                  const rel = element.getAttribute('rel')
                  if (!['stylesheet', 'preload', 'modulepreload'].includes(rel)) {
                    return
                  }
                }

                const hash = createHash(pluginOptions.algorithm).update(fileBuffer!).digest('base64')
                const integrity = `${pluginOptions.algorithm}-${hash}`
                element.setAttribute('integrity', integrity)
              }
            })
          )

          try {
            writeFileSync(filePath, root.toString())
          } catch (err) {
            console.error(`Error writing HTML file: ${filePath}`, err)
          }
        })
      )
    }
  }
}
