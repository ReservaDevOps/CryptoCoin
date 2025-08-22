import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('should encrypt and decrypt data with the same password', () => {
    const text = 'my secret';
    const password = 'p@ssw0rd';
    const encrypted = service.encrypt(text, password);
    const decrypted = service.decrypt(encrypted, password);
    expect(decrypted).toBe(text);
  });

  it('should throw error when decrypting with wrong password', () => {
    const text = 'my secret';
    const password = 'p@ssw0rd';
    const wrongPassword = 'other';
    const encrypted = service.encrypt(text, password);
    expect(() => service.decrypt(encrypted, wrongPassword)).toThrow();
  });
});
