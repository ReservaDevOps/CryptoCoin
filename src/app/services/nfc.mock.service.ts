/* eslint-disable @angular-eslint/prefer-inject */
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { NFCTagInfo } from 'capacitor-nfc-plugin/dist/esm/definitions';

@Injectable({
  providedIn: 'root'
})
export class NfcMockService {
  private mockTagContent: string | null = null;

  private tagReadSubject = new BehaviorSubject<NFCTagInfo | null>(null);
  tagRead$ = this.tagReadSubject.asObservable();

  private writeSuccessSubject = new Subject<void>();
  writeSuccess$ = this.writeSuccessSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  constructor(private ngZone: NgZone) {
    console.log('NfcMockService initialized');
  }

  async write(data: string): Promise<void> {
    console.log('[NFC MOCK] Writing data:', data);
    return new Promise(resolve => {
      setTimeout(() => {
        this.mockTagContent = data;
        this.ngZone.run(() => {
          this.writeSuccessSubject.next();
          alert('[NFC MOCK] Write successful!');
        });
        resolve();
      }, 500);
    });
  }

  async read(): Promise<void> {
    console.log('[NFC MOCK] Reading data...');
    return new Promise(resolve => {
      setTimeout(() => {
        if (this.mockTagContent) {
          const mockTag: NFCTagInfo = {
            id: 'mock-id',
            type: 'mock-type',
            techTypes: [],
            ndefMessage: this.mockTagContent,
          };
          this.ngZone.run(() => {
            this.tagReadSubject.next(mockTag);
            alert('[NFC MOCK] Read successful!');
          });
        } else {
          this.ngZone.run(() => {
            this.errorSubject.next('Mock NFC tag is empty.');
            alert('[NFC MOCK] Read failed: Tag is empty.');
          });
        }
        resolve();
      }, 500);
    });
  }
}
