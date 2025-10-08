import { Injectable } from '@angular/core';
import { deflate, inflate } from 'pako';

export type EncryptionAlgorithm = 'aes-gcm' | 'aes-cbc';

export interface EncryptOptions {
  algorithm: EncryptionAlgorithm;
  compress: boolean;
}

export interface EncryptionResult {
  payload: string;
  byteLength: number;
  algorithm: EncryptionAlgorithm;
  compressed: boolean;
}

interface EncryptionEnvelope {
  v: number;
  alg: EncryptionAlgorithm;
  comp: boolean;
  salt: string;
  iv: string;
  ct: string;
  mac?: string;
}

const SALT_LENGTH = 16;
const GCM_IV_LENGTH = 12;
const CBC_IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 310000;
const KEY_LENGTH_BITS = 256;
const HMAC_KEY_LENGTH_BITS = 256;

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  async encrypt(data: string, password: string, options: EncryptOptions): Promise<EncryptionResult> {
    if (!data) {
      throw new Error('No data provided for encryption');
    }
    if (!password) {
      throw new Error('Password is required for encryption');
    }

    const plaintextBytes = options.compress ? this.compress(data) : this.encoder.encode(data);
    const salt = this.secureRandom(SALT_LENGTH);

    switch (options.algorithm) {
      case 'aes-gcm':
        return this.encryptWithAesGcm(plaintextBytes, password, salt, options.compress);
      case 'aes-cbc':
        return this.encryptWithAesCbc(plaintextBytes, password, salt, options.compress);
      default:
        throw new Error(`Unsupported algorithm: ${options.algorithm}`);
    }
  }

  async decrypt(encryptedData: string, password: string): Promise<string> {
    if (!encryptedData) {
      throw new Error('No data provided for decryption');
    }
    if (!password) {
      throw new Error('Password is required for decryption');
    }

    const rawBytes = this.decodeBase64(encryptedData);
    let envelope: EncryptionEnvelope | null = null;

    try {
      const json = this.decoder.decode(rawBytes);
      const parsed = JSON.parse(json) as EncryptionEnvelope;
      if (parsed?.v === 1 && parsed.alg && parsed.salt && parsed.iv && parsed.ct) {
        envelope = parsed;
      }
    } catch {
      envelope = null;
    }

    let plaintextBytes: Uint8Array;
    if (envelope) {
      const salt = this.decodeBase64(envelope.salt);
      switch (envelope.alg) {
        case 'aes-gcm':
          plaintextBytes = await this.decryptWithAesGcm(envelope, password, salt);
          break;
        case 'aes-cbc':
          plaintextBytes = await this.decryptWithAesCbc(envelope, password, salt);
          break;
        default:
          throw new Error('Unsupported encryption algorithm in payload');
      }
      if (envelope.comp) {
        return this.decompress(plaintextBytes);
      }
      return this.decoder.decode(plaintextBytes);
    }

    // Legacy payload (salt + iv + ciphertext concatenated; AES-GCM without metadata)
    if (rawBytes.length <= SALT_LENGTH + GCM_IV_LENGTH) {
      throw new Error('Encrypted payload is malformed.');
    }
    const salt = rawBytes.slice(0, SALT_LENGTH);
    const iv = rawBytes.slice(SALT_LENGTH, SALT_LENGTH + GCM_IV_LENGTH);
    const ciphertext = rawBytes.slice(SALT_LENGTH + GCM_IV_LENGTH);
    const key = await this.deriveAesGcmKey(password, salt);
    try {
      const decrypted = await this.getSubtleCrypto().decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return this.decoder.decode(decrypted);
    } catch {
      throw new Error('Incorrect password or corrupted data');
    }
  }

  private async encryptWithAesGcm(plaintext: Uint8Array, password: string, salt: Uint8Array, compressed: boolean): Promise<EncryptionResult> {
    const subtle = this.getSubtleCrypto();
    const iv = this.secureRandom(GCM_IV_LENGTH);
    const key = await this.deriveAesGcmKey(password, salt);

    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const envelope: EncryptionEnvelope = {
      v: 1,
      alg: 'aes-gcm',
      comp: compressed,
      salt: this.encodeBase64(salt),
      iv: this.encodeBase64(iv),
      ct: this.encodeBase64(new Uint8Array(ciphertext)),
    };

    const payload = this.wrapEnvelope(envelope);
    return {
      payload,
      byteLength: this.encoder.encode(payload).length,
      algorithm: 'aes-gcm',
      compressed,
    };
  }

  private async encryptWithAesCbc(plaintext: Uint8Array, password: string, salt: Uint8Array, compressed: boolean): Promise<EncryptionResult> {
    const subtle = this.getSubtleCrypto();
    const iv = this.secureRandom(CBC_IV_LENGTH);
    const { encKey, macKey } = await this.deriveAesCbcKeys(password, salt);

    const ciphertext = await subtle.encrypt({ name: 'AES-CBC', iv }, encKey, plaintext);
    const mac = await subtle.sign('HMAC', macKey, this.concat(iv, new Uint8Array(ciphertext)));

    const envelope: EncryptionEnvelope = {
      v: 1,
      alg: 'aes-cbc',
      comp: compressed,
      salt: this.encodeBase64(salt),
      iv: this.encodeBase64(iv),
      ct: this.encodeBase64(new Uint8Array(ciphertext)),
      mac: this.encodeBase64(new Uint8Array(mac)),
    };

    const payload = this.wrapEnvelope(envelope);
    return {
      payload,
      byteLength: this.encoder.encode(payload).length,
      algorithm: 'aes-cbc',
      compressed,
    };
  }

  private async decryptWithAesGcm(envelope: EncryptionEnvelope, password: string, salt: Uint8Array): Promise<Uint8Array> {
    const subtle = this.getSubtleCrypto();
    const iv = this.decodeBase64(envelope.iv);
    const ciphertext = this.decodeBase64(envelope.ct);
    const key = await this.deriveAesGcmKey(password, salt);
    try {
      const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      return new Uint8Array(decrypted);
    } catch {
      throw new Error('Incorrect password or corrupted data');
    }
  }

  private async decryptWithAesCbc(envelope: EncryptionEnvelope, password: string, salt: Uint8Array): Promise<Uint8Array> {
    if (!envelope.mac) {
      throw new Error('Missing authentication data for AES-CBC payload');
    }
    const subtle = this.getSubtleCrypto();
    const iv = this.decodeBase64(envelope.iv);
    const ciphertext = this.decodeBase64(envelope.ct);
    const receivedMac = this.decodeBase64(envelope.mac);
    const { encKey, macKey } = await this.deriveAesCbcKeys(password, salt);

    const signingInput = this.concat(iv, ciphertext);
    const expectedMac = new Uint8Array(await subtle.sign('HMAC', macKey, signingInput));
    if (!this.constantTimeEqual(receivedMac, expectedMac)) {
      throw new Error('Incorrect password or corrupted data');
    }

    try {
      const decrypted = await subtle.decrypt({ name: 'AES-CBC', iv }, encKey, ciphertext);
      return new Uint8Array(decrypted);
    } catch {
      throw new Error('Incorrect password or corrupted data');
    }
  }

  private wrapEnvelope(envelope: EncryptionEnvelope): string {
    const jsonBytes = this.encoder.encode(JSON.stringify(envelope));
    return this.encodeBase64(jsonBytes);
  }

  private getSubtleCrypto(): SubtleCrypto {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      throw new Error('Secure cryptography is not available on this platform.');
    }
    return subtle;
  }

  private secureRandom(length: number): Uint8Array {
    const cryptoInstance = globalThis.crypto;
    if (!cryptoInstance?.getRandomValues) {
      throw new Error('Secure random generator is not available.');
    }
    const buffer = new Uint8Array(length);
    cryptoInstance.getRandomValues(buffer);
    return buffer;
  }

  private async deriveAesGcmKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await this.deriveKeyMaterial(password, salt, KEY_LENGTH_BITS);
    return this.getSubtleCrypto().importKey('raw', keyMaterial, { name: 'AES-GCM', length: KEY_LENGTH_BITS }, false, ['encrypt', 'decrypt']);
  }

  private async deriveAesCbcKeys(password: string, salt: Uint8Array): Promise<{ encKey: CryptoKey; macKey: CryptoKey }> {
    const combinedBits = KEY_LENGTH_BITS + HMAC_KEY_LENGTH_BITS;
    const bits = await this.deriveKeyMaterial(password, salt, combinedBits);
    const bytes = new Uint8Array(bits);
    const encBytes = bytes.slice(0, KEY_LENGTH_BITS / 8);
    const macBytes = bytes.slice(KEY_LENGTH_BITS / 8);
    const subtle = this.getSubtleCrypto();

    const encKey = await subtle.importKey('raw', encBytes, { name: 'AES-CBC', length: KEY_LENGTH_BITS }, false, ['encrypt', 'decrypt']);
    const macKey = await subtle.importKey('raw', macBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    return { encKey, macKey };
  }

  private async deriveKeyMaterial(password: string, salt: Uint8Array, bits: number): Promise<ArrayBuffer> {
    const subtle = this.getSubtleCrypto();
    const baseKey = await subtle.importKey('raw', this.encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt }, baseKey, bits);
  }

  private encodeBase64(data: Uint8Array): string {
    let binary = '';
    data.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return globalThis.btoa(binary);
  }

  private decodeBase64(payload: string): Uint8Array {
    const binary = globalThis.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  private constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff === 0;
  }

  private compress(data: string): Uint8Array {
    const input = this.encoder.encode(data);
    return deflate(input);
  }

  private decompress(data: Uint8Array): string {
    const output = inflate(data);
    return this.decoder.decode(output);
  }
}
