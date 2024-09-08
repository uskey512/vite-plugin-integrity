import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { Options } from './types'

const DEFAULT_OPTIONS: Required<Options> = {
  algorithm: 'sha256',
  charset: 'utf8' as BufferEncoding
}

export function sri(userOptions: Options = DEFAULT_OPTIONS) {
  const pluginOptions = { ...DEFAULT_OPTIONS, ...userOptions }

  return {
    name: 'vite-plugin-integrity',
    apply: 'build',
    enforce: 'post',
    writeBundle(options, bundle) {
      const outputDir = options.dir ? options.dir : 'dist'
      const htmlFiles = Object.keys(bundle).filter((file) => file.endsWith('.html'))

      htmlFiles.forEach((file) => {
        const filePath = resolve(outputDir, file)
        let html = readFileSync(filePath, pluginOptions.charset)
        Object.keys(bundle).forEach((bundleFile) => {
          const asset = bundle[bundleFile]
          if (asset && (bundleFile.endsWith('.js') || bundleFile.endsWith('.css'))) {
            const resolevedFilePath = resolve(outputDir, bundleFile)
            const fileBuffer = readFileSync(resolevedFilePath)
            const hash = createHash(pluginOptions.algorithm).update(fileBuffer).digest('base64')
            const integrity = `${pluginOptions.algorithm}-${hash}`

            html = html.replace(
              new RegExp(`(<script .*?src=".*?${bundleFile}".*?)>`, 'g'),
              `$1 integrity="${integrity}">`
            )
            html = html.replace(
              new RegExp(`(<link .*?href=".*?${bundleFile}".*?)>`, 'g'),
              `$1 integrity="${integrity}">`
            )
          }
        })
        writeFileSync(filePath, html)
      })
    }
  }
}
