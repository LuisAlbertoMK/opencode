import nodePath from "path"
import { Platform } from "@/util/platform"
import { customType } from "drizzle-orm/sqlite-core"
import { AbsolutePath } from "../schema"

function storagePath(input: string) {
  if (!Platform.isWindows) return input
  return input.replaceAll("\\", "/")
}

function isWindowsStoragePath(input: string) {
  return /^[A-Za-z]:\//.test(input) || input.startsWith("//")
}

function absolute(input: string) {
  const result = storagePath(input)
  if (!nodePath.posix.isAbsolute(result) && !(Platform.isWindows && isWindowsStoragePath(result))) {
    throw new Error(`Path is not absolute: ${input}`)
  }
  return result
}

function toPlatform(input: string) {
  if (!Platform.isWindows || !isWindowsStoragePath(input)) return input
  return input.replaceAll("/", "\\")
}

export const absoluteColumn = customType<{
  data: AbsolutePath
  driverData: string
  driverOutput: string
}>({
  dataType() {
    return "text"
  },
  toDriver(input) {
    return absolute(input)
  },
  fromDriver(input) {
    return AbsolutePath.make(toPlatform(absolute(input)))
  },
})

// Legacy sessions may persist an empty directory. Keep that existing value
// readable while normalizing and validating every real directory.
export const directoryColumn = customType<{
  data: string
  driverData: string
  driverOutput: string
}>({
  dataType() {
    return "text"
  },
  toDriver(input) {
    return input ? absolute(input) : input
  },
  fromDriver(input) {
    return input ? toPlatform(absolute(input)) : input
  },
})

export const pathColumn = customType<{
  data: string
  driverData: string
  driverOutput: string
}>({
  dataType() {
    return "text"
  },
  toDriver(input) {
    return storagePath(input)
  },
  fromDriver(input) {
    return storagePath(input)
  },
})

export const absoluteArrayColumn = customType<{
  data: AbsolutePath[]
  driverData: string
  driverOutput: string
}>({
  dataType() {
    return "text"
  },
  toDriver(input) {
    return JSON.stringify(input.map(absolute))
  },
  fromDriver(input) {
    let items: string[]
    try { items = JSON.parse(input) as string[] } catch { return [] }
    return items.map((item) => AbsolutePath.make(toPlatform(absolute(item))))
  },
})
