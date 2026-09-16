import { safeStorage, app } from "electron";
import fs from "fs";
import path from "path";

// Credentials are encrypted with the OS keychain (macOS Keychain / Windows DPAPI /
// Linux libsecret) and stored as opaque binary blobs in userData/credentials/.
// The plaintext never touches disk.

function credsDir(): string {
  const dir = path.join(app.getPath("userData"), "credentials");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filePath(name: string): string {
  return path.join(credsDir(), `${name.replace(/[^a-z0-9_]/gi, "_")}.enc`);
}

export function encryptCredential(name: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS-native encryption is not available on this system.");
  }
  fs.writeFileSync(filePath(name), safeStorage.encryptString(value));
}

export function decryptCredential(name: string): string | null {
  const p = filePath(name);
  if (!fs.existsSync(p) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(fs.readFileSync(p));
  } catch {
    return null;
  }
}

export function hasCredential(name: string): boolean {
  return fs.existsSync(filePath(name));
}

export function deleteCredential(name: string): void {
  const p = filePath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
