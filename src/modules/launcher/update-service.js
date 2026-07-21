'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const METADATA_FILES = ['latest.yml', 'latest-linux.yml']
const ALLOWED_ARTIFACT = /\.(?:yml|yaml|exe|blockmap|AppImage|deb)$/i

function readUpdateMetadata(directory, filename = 'latest.yml') {
  const metadataPath = path.join(directory, filename)
  const parsed = YAML.parse(fs.readFileSync(metadataPath, 'utf8'))
  if (!parsed || typeof parsed.version !== 'string' || !parsed.version.trim()) {
    throw new Error(`${filename} does not contain a version`)
  }
  if ((!Array.isArray(parsed.files) || parsed.files.length === 0) && !parsed.path) {
    throw new Error(`${filename} does not reference an update artifact`)
  }
  return parsed
}

function getMetadataArtifacts(metadata) {
  if (Array.isArray(metadata.files) && metadata.files.length > 0) {
    return metadata.files.map(file => ({
      url: file.url,
      sha512: file.sha512,
    }))
  }
  return [{ url: metadata.path, sha512: metadata.sha512 }]
}

function resolveArtifactPath(directory, artifactUrl) {
  if (typeof artifactUrl !== 'string' || !artifactUrl) throw new Error('artifact URL is missing')
  const relative = decodeURIComponent(artifactUrl.split(/[?#]/, 1)[0]).replace(/\\/g, '/')
  if (path.posix.isAbsolute(relative) || relative.split('/').includes('..')) {
    throw new Error(`artifact path escapes the update directory: ${artifactUrl}`)
  }
  const root = path.resolve(directory)
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`artifact path escapes the update directory: ${artifactUrl}`)
  }
  return resolved
}

function fileSha512(filename) {
  return crypto.createHash('sha512').update(fs.readFileSync(filename)).digest('base64')
}

function validateUpdateDirectory(directory) {
  const metadata = {}
  for (const filename of METADATA_FILES) {
    metadata[filename] = readUpdateMetadata(directory, filename)
    for (const artifact of getMetadataArtifacts(metadata[filename])) {
      const artifactPath = resolveArtifactPath(directory, artifact.url)
      if (!fs.existsSync(artifactPath)) throw new Error(`missing update artifact: ${artifact.url}`)
      if (!artifact.sha512 || fileSha512(artifactPath) !== artifact.sha512) {
        throw new Error(`SHA-512 mismatch for update artifact: ${artifact.url}`)
      }
    }
  }
  return metadata
}

function copyUpdateFiles(sourceDirectory, targetDirectory, metadataByFile) {
  fs.mkdirSync(targetDirectory, { recursive: true })

  const relativeFiles = new Set(METADATA_FILES)
  for (const metadata of Object.values(metadataByFile)) {
    for (const artifact of getMetadataArtifacts(metadata)) {
      const sourcePath = resolveArtifactPath(sourceDirectory, artifact.url)
      const relative = path.relative(sourceDirectory, sourcePath)
      relativeFiles.add(relative)
      if (fs.existsSync(`${sourcePath}.blockmap`)) relativeFiles.add(`${relative}.blockmap`)
    }
  }

  for (const relative of relativeFiles) {
    if (!ALLOWED_ARTIFACT.test(relative)) throw new Error(`unsupported update artifact: ${relative}`)
    const sourcePath = resolveArtifactPath(sourceDirectory, relative)
    const targetPath = resolveArtifactPath(targetDirectory, relative)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(sourcePath, targetPath)
  }
  fs.writeFileSync(path.join(targetDirectory, '.gitkeep'), '')
}

function syncLauncherUpdates(sourceDirectory, targetDirectory) {
  const source = path.resolve(sourceDirectory)
  const target = path.resolve(targetDirectory)
  if (!fs.statSync(source).isDirectory()) throw new Error(`not a directory: ${source}`)
  const sourceMetadata = validateUpdateDirectory(source)

  const parent = path.dirname(target)
  const staging = path.join(parent, `.launcher-updates-staging-${process.pid}-${Date.now()}`)
  const backup = path.join(parent, `.launcher-updates-backup-${process.pid}-${Date.now()}`)
  fs.mkdirSync(parent, { recursive: true })

  try {
    copyUpdateFiles(source, staging, sourceMetadata)
    validateUpdateDirectory(staging)
    if (fs.existsSync(target)) fs.renameSync(target, backup)
    fs.renameSync(staging, target)
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true })
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true })
    if (!fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target)
    throw error
  }

  return validateUpdateDirectory(target)
}

function setLauncherUpdateHeaders(res, filename) {
  if (/latest(?:-linux|-mac)?\.ya?ml$/i.test(path.basename(filename))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  }
}

function getLegacyVersionInfo(directory, publicUrl) {
  const metadata = readUpdateMetadata(directory, 'latest.yml')
  const artifact = getMetadataArtifacts(metadata)[0]
  const encodedPath = artifact.url.split('/').map(encodeURIComponent).join('/')
  return {
    version: metadata.version,
    downloadUrl: `${publicUrl.replace(/\/$/, '')}/${encodedPath}`,
  }
}

module.exports = {
  getLegacyVersionInfo,
  readUpdateMetadata,
  setLauncherUpdateHeaders,
  syncLauncherUpdates,
  validateUpdateDirectory,
}
