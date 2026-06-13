import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import os from "node:os"

const IV_LENGTH = 16 // AES-GCM standard
const AUTH_TAG_LENGTH = 16

function getRawKey(): Buffer {
  const seed = `${os.hostname()}|${os.homedir()}|opencode-auth-v1`
  return createHash("sha256").update(seed).digest()
}

/** Encrypt plaintext to base64 (iv + authTag + ciphertext). */
export function encrypt(plaintext: string): string {
  const key = getRawKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

/** Decrypt base64 (iv + authTag + ciphertext) back to plaintext. */
export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const key = getRawKey()
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8")
}

export * as AuthCrypto from "./crypto"
