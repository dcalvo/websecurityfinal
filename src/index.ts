import * as fs from "fs"
import * as path from "path"
import extract from "extract-zip"
import webpack from "webpack"
import ncp from "ncp"

// Unzip XPI archives into folders
async function extractArchives(extensionsDir: string, outDir: string) {
  outDir = path.resolve(outDir)
  const files = fs.readdirSync(extensionsDir)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const filePath = path.join(extensionsDir, file)
    const outPath = path.join(outDir, file)
    process.stdout.write(`Unzipping ${i + 1} out of ${files.length}... `)
    try {
      await extract(filePath, { dir: outPath })
      console.log("COMPLETE")
    } catch (e) {
      console.error("Error during unzipping: ", e)
      console.log("Continuing...")
      continue
    }
  }
}

type ExtensionManifest = {
  manifest_version: number
  background: { scripts: [string] }
  content_scripts: { js: [string] }[]
}

// Use webpack to bundle extension scripts down to as few files as possible (to the best of my ability)
async function _bundleExtension(
  archive: string,
  archivePath: string,
  backgroundScripts: string[],
  contentScripts: string[]
) {
  return new Promise((resolve, reject) => {
    const options = (
      script: string,
      background: boolean
    ): webpack.Configuration => {
      return {
        mode: "none",
        entry: path.join("./", script),
        context: path.resolve(archivePath),
        output: {
          path: path.join(
            __dirname,
            "../bundled/",
            archive,
            background ? "background_scripts/" : "content_scripts/"
          ),
          filename: script.split("/").pop(),
        },
        resolve: {
          preferRelative: true,
          fallback: {
            assert: require.resolve("assert"),
            buffer: require.resolve("buffer"),
            console: require.resolve("console-browserify"),
            constants: require.resolve("constants-browserify"),
            crypto: require.resolve("crypto-browserify"),
            domain: require.resolve("domain-browser"),
            events: require.resolve("events"),
            http: require.resolve("stream-http"),
            https: require.resolve("https-browserify"),
            path: require.resolve("path-browserify"),
            punycode: require.resolve("punycode"),
            querystring: require.resolve("querystring-es3"),
            stream: require.resolve("stream-browserify"),
            string_decoder: require.resolve("string_decoder"),
            sys: require.resolve("util"),
            timers: require.resolve("timers-browserify"),
            tty: require.resolve("tty-browserify"),
            url: require.resolve("url"),
            util: require.resolve("util"),
            vm: require.resolve("vm-browserify"),
            zlib: require.resolve("browserify-zlib"),
          },
        },
      }
    }

    const callback = (
      err: Error | undefined,
      stats: webpack.Stats | undefined,
      resolve: (value: unknown) => void
    ) => {
      if (err) {
        // console.error(err.stack || err)
        resolve(false)
        return
      }
      const info = stats!.toJson()
      if (stats!.hasErrors()) {
        // console.error(info.errors)
        resolve(false)
        return
      }
      resolve(true)
    }

    let promises = []

    for (const backgroundScript of backgroundScripts)
      promises.push(
        new Promise((resolve) =>
          webpack(options(backgroundScript, true), (err, stats) =>
            callback(err, stats, resolve)
          )
        )
      )

    for (const contentScript of contentScripts)
      promises.push(
        new Promise((resolve) =>
          webpack(options(contentScript, false), (err, stats) =>
            callback(err, stats, resolve)
          )
        )
      )

    Promise.all(promises).then((values) => {
      resolve(values.every(Boolean))
    })
  })
}

// Read each extension's manifest to bundle their scripts
async function bundleScripts(archivesDir: string) {
  let skipped = 0
  const successful_archives = []
  try {
    const archives = fs.readdirSync(archivesDir)
    for (let i = 0; i < archives.length; i++) {
      process.stdout.write(`Bundling ${i + 1} out of ${archives.length}... `)
      const archiveFolder = archives[i]
      const archiveFolderPath = path.join(archivesDir, archiveFolder)
      // assumes manifest.json is at the root of the directory, but this should be true according to Mozilla's submission requirements
      const manifestPath = path.join(archiveFolderPath, "manifest.json")
      if (!fs.existsSync(manifestPath)) {
        // missing manifest
        console.log("SKIPPING")
        console.log("Manifest.json not found")
        skipped++
        continue
      }
      const backgroundScripts = []
      const contentScripts = []
      try {
        const manifest: ExtensionManifest = JSON.parse(
          fs.readFileSync(manifestPath, "utf8")
        )
        // collate background scripts
        if (!manifest.background || !manifest.background.scripts) {
          // no background script
          console.log("SKIPPING")
          console.log("Missing background script")
          skipped++
          continue
        }
        for (const script of manifest.background.scripts)
          backgroundScripts.push(script)
        // collate content scripts
        if (!manifest.content_scripts) continue
        for (const scriptObj of manifest.content_scripts)
          for (const script of scriptObj.js) contentScripts.push(script)
      } catch (e) {
        // parsing error
        console.log("SKIPPING")
        console.log("Malformed manifest.json")
        skipped++
        continue
      }
      const success = await _bundleExtension(
        archiveFolder,
        archiveFolderPath,
        backgroundScripts,
        contentScripts
      )
      if (!success) {
        // bundling error
        console.log("SKIPPING")
        console.log("Failed to bundle scripts")
        skipped++
        continue
      }
      console.log("COMPLETE")
      successful_archives.push(archiveFolder)
    }
    console.log(`Skipped ${skipped} archives out of ${archives.length}`)
  } catch (e) {
    console.error("Error during bundling: ", e)
  }
  return successful_archives
}

function copyArchives(
  bundleDir: string,
  successfullyBundledArchives: string[],
  outDir: string
) {
  outDir = path.resolve(outDir)
  fs.mkdirSync(outDir)
  const bundles = fs.readdirSync(bundleDir)
  for (let i = 0; i < bundles.length; i++) {
    const bundle = bundles[i]
    if (successfullyBundledArchives.includes(bundle)) {
      const bundlePath = path.join(bundleDir, bundle)
      const outPath = path.join(outDir, bundle)
      try {
        ncp(bundlePath, outPath, (err) => {
          if (err) throw err
        })
      } catch (e) {
        console.error("Error during copying: ", e)
        console.log("Continuing...")
        continue
      }
    }
  }
}

const extensionsFolder = "./extensions"
const archivesFolder = "./archives"
const analysisFolder = "./readytogo"

;(async () => {
  console.log("Extracting...")
  await extractArchives(extensionsFolder, archivesFolder)
  console.log("Bundling...")
  const successfullyBundledArchives = await bundleScripts(archivesFolder)
  console.log("Copying...")
  copyArchives("./bundled", successfullyBundledArchives, analysisFolder)
})()
