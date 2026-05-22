import CryptoJS from "crypto-js";

function getEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY environment variable is not set or is too short. " +
        "Generate one with: openssl rand -hex 16"
      );
    }
    // Development fallback — never used in production
    return "dev_fallback_key_do_not_use_in_prod";
  }
  return key;
}

export function encryptToken(token: string): string {
  return CryptoJS.AES.encrypt(token, getEncryptionKey()).toString();
}

export function decryptToken(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, getEncryptionKey());
  const result = bytes.toString(CryptoJS.enc.Utf8);
  if (!result) throw new Error("Failed to decrypt token — key mismatch or corrupted data");
  return result;
}
