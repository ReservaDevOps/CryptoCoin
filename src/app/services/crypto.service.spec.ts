import { TestBed } from '@angular/core/testing';
import { CryptoService, EncryptOptions } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  const optionsAesGcm: EncryptOptions = { algorithm: 'aes-gcm', compress: false };
  const optionsAesCbc: EncryptOptions = { algorithm: 'aes-cbc', compress: false };
  const optionsCompressed: EncryptOptions = { algorithm: 'aes-gcm', compress: true };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('should encrypt and decrypt data with AES-GCM', async () => {
    const text = 'my secret';
    const password = 'p@ssw0rd';

    const { payload, byteLength } = await service.encrypt(text, password, optionsAesGcm);
    expect(payload).not.toBe(text);
    expect(byteLength).toBe(payload.length);

    const decrypted = await service.decrypt(payload, password);
    expect(decrypted).toBe(text);
  });

  it('should encrypt and decrypt data with AES-CBC + HMAC', async () => {
    const text = 'dados muito importantes';
    const password = 'senha forte';

    const { payload } = await service.encrypt(text, password, optionsAesCbc);
    expect(payload).not.toBe(text);

    const decrypted = await service.decrypt(payload, password);
    expect(decrypted).toBe(text);
  });

  it('should support compression before encryption', async () => {
    const text = 'frase longa '.repeat(20);
    const password = 'compressao';

    const { payload, byteLength, compressed } = await service.encrypt(text, password, optionsCompressed);
    expect(compressed).toBeTrue();
    expect(byteLength).toBe(payload.length);

    const decrypted = await service.decrypt(payload, password);
    expect(decrypted).toBe(text);
  });

  it('should reject decryption with wrong password', async () => {
    const text = 'conteúdo sigiloso';
    const password = 'correto';
    const wrong = 'incorreto';

    const { payload } = await service.encrypt(text, password, optionsAesGcm);
    await expectAsync(service.decrypt(payload, wrong)).toBeRejectedWithError('Incorrect password or corrupted data');
  });

  it('should decrypt legacy AES-GCM payloads (salt+iv+ciphertext)', async () => {
    const text = 'legacy payload';
    const password = 'password123';

    const { payload } = await service.encrypt(text, password, optionsAesGcm);
    const envelopeBytes = Uint8Array.from(globalThis.atob(payload), char => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(envelopeBytes));
    const salt = globalThis.atob(parsed.salt);
    const iv = globalThis.atob(parsed.iv);
    const ct = globalThis.atob(parsed.ct);
    const legacyBytes = new Uint8Array(salt.length + iv.length + ct.length);
    legacyBytes.set([...salt].map(c => c.charCodeAt(0)), 0);
    legacyBytes.set([...iv].map(c => c.charCodeAt(0)), salt.length);
    legacyBytes.set([...ct].map(c => c.charCodeAt(0)), salt.length + iv.length);
    const legacyPayload = globalThis.btoa(String.fromCharCode(...legacyBytes));

    const decrypted = await service.decrypt(legacyPayload, password);
    expect(decrypted).toBe(text);
  });
});
