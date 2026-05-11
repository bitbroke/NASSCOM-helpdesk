import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TICKET_ENCRYPTION_KEY || ''; // Must be 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    console.warn("Encryption key is not set or invalid length (must be 64 hex chars). Returning unencrypted.");
    return text; // Fallback if key is missing
  }

  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error("Encryption failed:", err);
    return text;
  }
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64 || !text.includes(':')) {
    return text; // Not encrypted or missing key
  }

  try {
    const parts = text.split(':');
    if (parts.length !== 3) return text;
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return text; // Return raw (might be encrypted text still, but fallback)
  }
}
