import os from "os"
import { Platform } from "@/util/platform"
import path from "path"

const home = os.homedir()

const DARWIN_HOME = [
  "Music",
  "Pictures",
  "Movies",
  "Downloads",
  "Desktop",
  "Documents",
  "Public",
  "Applications",
  "Library",
]

const DARWIN_LIBRARY = [
  "Application Support/AddressBook",
  "Calendars",
  "Mail",
  "Messages",
  "Safari",
  "Cookies",
  "Application Support/com.apple.TCC",
  "PersonalizationPortrait",
  "Metadata/CoreSpotlight",
  "Suggestions",
]

const DARWIN_ROOT = ["/.DocumentRevisions-V100", "/.Spotlight-V100", "/.Trashes", "/.fseventsd"]
const WIN32_HOME = ["AppData", "Downloads", "Desktop", "Documents", "Pictures", "Music", "Videos", "OneDrive"]

/** Directory basenames to skip when scanning the home directory. */
export function names(): ReadonlySet<string> {
  if (Platform.isMac) return new Set(DARWIN_HOME)
  if (Platform.isWindows) return new Set(WIN32_HOME)
  return new Set()
}

/** Absolute paths that should never be watched, stated, or scanned. */
export function paths(): string[] {
  if (Platform.isMac)
    return [
      ...DARWIN_HOME.map((name) => path.join(home, name)),
      ...DARWIN_LIBRARY.map((name) => path.join(home, "Library", name)),
      ...DARWIN_ROOT,
    ]
  if (Platform.isWindows) return WIN32_HOME.map((name) => path.join(home, name))
  return []
}

export * as Protected from "./protected"
