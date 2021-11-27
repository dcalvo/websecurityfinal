import * as fs from "fs"
import * as path from "path"
import extract from "extract-zip"
import webpack from "webpack"

// Unzip XPI archives into folders
function extractArchives(extensionsDir: string, outDir: string) {
  try {
    outDir = path.resolve(outDir)
    const files = fs.readdirSync(extensionsDir)
    for (let i = 0; i < files.length; i++) {
      if (i == 3) break // TODO: remove
      const file = files[i]
      const filePath = path.join(extensionsDir, file)
      const outPath = path.join(outDir, file)
      process.stdout.write(`Unzipping ${i + 1} out of ${files.length}... `)
      extract(filePath, { dir: outPath })
      process.stdout.write("COMPLETE")
      console.log()
    }
  } catch (e) {
    console.error("Error during unzipping: ", e)
  }
}

type ExtensionManifest = {
  background: { scripts: [string] }
  content_scripts: { js: [string] }[]
}

// Read each extension's manifest to bundle their scripts
function bundleScripts(archivesDir: string) {
  try {
    const archives = fs.readdirSync(archivesDir)
    for (let i = 0; i < archives.length; i++) {
      const archiveFolder = archives[i]
      const archiveFolderPath = path.join(archivesDir, archiveFolder)
      // assumes manifest.json is at the root of the directory, but this should be true according to Mozilla's submission requirements
      const manifest: ExtensionManifest = JSON.parse(
        fs.readFileSync(path.join(archiveFolderPath, "manifest.json"), "utf-8")
      )
      console.log(manifest.background.scripts)
    }
  } catch (e) {
    console.error("Error during bundling: ", e)
  }
}

const extensionsFolder = "./extensions"
const archivesFolder = "./archives"

//extractArchives(extensionsFolder, outFolder)
bundleScripts(archivesFolder)
