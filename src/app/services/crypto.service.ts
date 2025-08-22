import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  encrypt(data: string, password: string): string {
    if (!data) {
      throw new Error('No data provided for encryption');
    }
    if (!password) {
      throw new Error('Password is required for encryption');
    }
    return CryptoJS.AES.encrypt(data, password).toString();
  }

  decrypt(encryptedData: string, password: string): string {
    if (!encryptedData) {
      throw new Error('No data provided for decryption');
    }
    if (!password) {
      throw new Error('Password is required for decryption');
    }
    const bytes = CryptoJS.AES.decrypt(encryptedData, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error('Incorrect password or corrupted data');
    }
    return decrypted;
  }
}
