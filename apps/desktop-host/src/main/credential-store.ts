import { readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { safeStorage } from 'electron'

interface StoredCredentials {
  region: string
  encryptedKey: string
}

export class CredentialStore {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'azure-credentials.json')
  }

  async save(region: string, key: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows credential encryption is unavailable on this computer.')
    }
    const payload: StoredCredentials = {
      region,
      encryptedKey: safeStorage.encryptString(key).toString('base64')
    }
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 })
  }

  async load(): Promise<{ region: string; key: string } | undefined> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const value = JSON.parse(raw) as Partial<StoredCredentials>
      if (!value.region || !value.encryptedKey || !safeStorage.isEncryptionAvailable()) {
        return undefined
      }
      return {
        region: value.region,
        key: safeStorage.decryptString(Buffer.from(value.encryptedKey, 'base64'))
      }
    } catch (error) {
      if (isMissingFile(error)) {
        return undefined
      }
      throw error
    }
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true })
  }
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}
