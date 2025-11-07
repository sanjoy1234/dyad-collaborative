/**
 * API Key Encryption Utility
 * Uses AES-256-GCM encryption to securely store user API keys
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * In production, this should be a secure random key stored in environment variables
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  return key;
}

/**
 * Derive a cryptographic key from the master key and salt using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data (like API keys)
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:encryptedData (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
  try {
    const masterKey = getEncryptionKey();
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive encryption key from master key and salt
    const key = deriveKey(masterKey, salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine salt, IV, auth tag, and encrypted data
    const result = `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt encrypted data
 * @param ciphertext - The encrypted string in format: salt:iv:authTag:encryptedData
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
  try {
    const masterKey = getEncryptionKey();
    
    // Split the ciphertext into components
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid ciphertext format');
    }
    
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];
    
    // Derive the same key using salt
    const key = deriveKey(masterKey, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data for comparison (e.g., password hashing)
 * @param data - The data to hash
 * @returns Hashed string with salt
 */
export function hash(data: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(data, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify hashed data
 * @param data - The plaintext data
 * @param hashedData - The hashed data to compare against
 * @returns True if data matches hash
 */
export function verifyHash(data: string, hashedData: string): boolean {
  try {
    const parts = hashedData.split(':');
    if (parts.length !== 2) {
      return false;
    }
    
    const salt = Buffer.from(parts[0], 'hex');
    const originalHash = Buffer.from(parts[1], 'hex');
    
    const hash = crypto.pbkdf2Sync(data, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    
    return crypto.timingSafeEqual(originalHash, hash);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a secure random token (for session tokens, invite codes, etc.)
 * @param length - Length of the token in bytes (default: 32)
 * @returns Random hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Mask sensitive data for logging (show only first and last 4 characters)
 * @param data - The sensitive data to mask
 * @returns Masked string like "sk-1234...7890"
 */
export function maskSensitiveData(data: string): string {
  if (!data || data.length <= 8) {
    return '****';
  }
  const start = data.substring(0, 4);
  const end = data.substring(data.length - 4);
  return `${start}...${end}`;
}
