/**
 * Token Encryption Utility
 * 
 * Uses Web Crypto API (AES-GCM) to encrypt/decrypt Fortnox OAuth tokens
 * Encryption key is stored in Supabase secrets (FORTNOX_TOKEN_ENCRYPTION_KEY)
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/**
 * Derives a CryptoKey from the base64-encoded encryption key
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('FORTNOX_TOKEN_ENCRYPTION_KEY');
  
  if (!keyString) {
    throw new Error('FORTNOX_TOKEN_ENCRYPTION_KEY not configured');
  }

  // Decode base64 key
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a token string
 * Returns: base64-encoded string in format: iv.ciphertext
 */
export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty token');
  }

  const key = await getEncryptionKey();
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintextBytes
  );
  
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a token string
 * Input: base64-encoded string in format: iv.ciphertext
 * Returns: original plaintext token
 */
export async function decryptToken(encrypted: string): Promise<string> {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty token');
  }

  const key = await getEncryptionKey();
  
  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  
  // Decrypt
  const plaintextBytes = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
  
  // Decode bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}

/**
 * Checks if a token is encrypted (base64 format with IV prefix)
 * Used for migration: allows reading both encrypted and plaintext tokens
 */
export function isTokenEncrypted(token: string): boolean {
  if (!token || token.length < 32) return false;
  
  // Encrypted tokens are base64 and have specific length characteristics
  // They should be longer than typical JWT tokens and contain IV prefix
  try {
    const decoded = atob(token);
    // Check if it looks like encrypted data (has IV prefix of 12 bytes)
    return decoded.length > IV_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Migration helper: reads a token that might be encrypted or plaintext
 * This allows gradual migration without breaking existing integrations
 */
export async function readToken(token: string): Promise<string> {
  if (!token) {
    throw new Error('Token is empty');
  }

  if (isTokenEncrypted(token)) {
    console.log('🔓 Decrypting token...');
    return await decryptToken(token);
  } else {
    console.log('⚠️ Token is not encrypted (plaintext). Will be encrypted on next update.');
    return token;
  }
}
