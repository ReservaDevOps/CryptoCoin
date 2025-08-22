
/* eslint-disable @angular-eslint/prefer-inject */
import { Injectable, NgZone } from '@angular/core';
import { Nfc } from 'capacitor-nfc-plugin';
import { BehaviorSubject, Subject } from 'rxjs';
import { Platform } from '@ionic/angular';
import { NFCTagInfo } from 'capacitor-nfc-plugin/dist/esm/definitions';

@Injectable({
  providedIn: 'root'
})
export class NfcService {
  private tagReadSubject = new BehaviorSubject<NFCTagInfo | null>(null);
  tagRead$ = this.tagReadSubject.asObservable();

  private writeSuccessSubject = new Subject<void>();
  writeSuccess$ = this.writeSuccessSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  constructor(private platform: Platform, private ngZone: NgZone) {
    this.addNfcListeners();
  }

  private addNfcListeners() {
    if (this.platform.is('capacitor')) {
      Nfc.addListener('nfcStatus', ({ status }) => {
        if (status !== 'enabled') {
          this.ngZone.run(() => this.errorSubject.next('NFC is not enabled.'));
        }
      });

      Nfc.addListener('readSuccess', (tag) => {
        this.ngZone.run(() => this.tagReadSubject.next(tag));
      });

      Nfc.addListener('writeSuccess', () => {
        this.ngZone.run(() => this.writeSuccessSubject.next());
      });

      Nfc.addListener('writeError', (error) => {
        console.error('Error writing to NFC', error);
        this.ngZone.run(() => this.errorSubject.next('Failed to write to NFC tag. Please try again.'));
      });

      Nfc.addListener('nfcError', (error) => {
        console.error('NFC Error', error);
        this.ngZone.run(() => this.errorSubject.next('An NFC error occurred.'));
      });
    }
  }

  async write(data: string): Promise<void> {
    if (this.platform.is('capacitor')) {
      try {
        await Nfc.write({ text: data });
      } catch (error) {
        console.error('Error writing to NFC', error);
        this.errorSubject.next('Failed to write to NFC tag.');
        throw error;
      }
    } else {
      const message = 'NFC is not available on this platform.';
      this.errorSubject.next(message);
      throw new Error(message);
    }
  }

  async read(): Promise<void> {
    if (this.platform.is('capacitor')) {
      try {
        await Nfc.read();
      } catch (error) {
        console.error('Error reading from NFC', error);
        this.errorSubject.next('Failed to read NFC tag.');
        throw error;
      }
    } else {
      const message = 'NFC is not available on this platform.';
      this.errorSubject.next(message);
      throw new Error(message);
    }
  }
}
