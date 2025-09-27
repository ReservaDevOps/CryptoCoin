/* eslint-disable @angular-eslint/prefer-inject */
import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { BehaviorSubject, Subject } from 'rxjs';
import { NFC, NDEFMessagesTransformable, NFCError } from '@exxili/capacitor-nfc';

@Injectable({
  providedIn: 'root'
})
export class NfcService {
  private readonly isNative = Capacitor.getPlatform() !== 'web';

  private tagReadSubject = new BehaviorSubject<string | null>(null);
  tagRead$ = this.tagReadSubject.asObservable();

  private writeSuccessSubject = new Subject<void>();
  writeSuccess$ = this.writeSuccessSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  private textDecoder = new TextDecoder();
  private listenersRegistered = false;

  constructor(private platform: Platform, private ngZone: NgZone) {
    this.waitForAppReady();
  }

  private waitForAppReady(): void {
    if (!this.isNative) {
      return;
    }

    if (Capacitor.isPluginAvailable('App')) {
      App.addListener('appStateChange', () => this.registerListenersOnce());
    }

    this.registerListenersOnce();
  }

  private registerListenersOnce(): void {
    if (this.listenersRegistered || !this.isNative) {
      return;
    }

    this.listenersRegistered = true;

    console.info('[NFC] Registering listeners');

    NFC.isSupported()
      .then(({ supported }) => {
        console.info('[NFC] Support status', supported);
        this.ngZone.run(() => {
          this.errorSubject.next(supported ? null : 'NFC hardware is not available on this device.');
        });
      })
      .catch(error => {
        console.error('[NFC] Error checking support', error);
        this.ngZone.run(() => this.errorSubject.next('Could not verify NFC support.'));
      });

    NFC.onRead(data => {
      console.info('[NFC] Tag detected', data.base64());
      const payload = this.extractPayload(data);
      this.ngZone.run(() => {
        if (payload) {
          this.tagReadSubject.next(payload);
        } else {
          this.errorSubject.next('Received NFC tag without readable payload.');
        }
      });
    });

    NFC.onWrite(() => {
      console.info('[NFC] Write success');
      this.ngZone.run(() => this.writeSuccessSubject.next());
    });

    NFC.onError((error: NFCError) => {
      console.error('[NFC] Plugin error', error);
      this.ngZone.run(() => this.errorSubject.next(error?.error ?? 'An NFC error occurred.'));
    });
  }

  private extractPayload(data: NDEFMessagesTransformable): string | null {
    try {
      const messages = data.uint8Array().messages;
      const firstRecord = messages?.[0]?.records?.[0];
      if (!firstRecord) {
        return null;
      }
      return this.textDecoder.decode(firstRecord.payload);
    } catch (error) {
      console.error('[NFC] Error decoding payload', error);
      return null;
    }
  }

  async write(data: string): Promise<void> {
    if (!this.isNative) {
      const message = 'NFC is not available on this platform.';
      this.errorSubject.next(message);
      throw new Error(message);
    }

    console.info('[NFC] Initiating write');

    try {
      await NFC.writeNDEF({
        records: [
          {
            type: 'T',
            payload: data,
          },
        ],
      });
    } catch (error) {
      console.error('[NFC] Error writing', error);
      this.ngZone.run(() => this.errorSubject.next('Failed to write to NFC tag.'));
      throw error;
    }
  }

  async read(): Promise<void> {
    if (!this.isNative) {
      const message = 'NFC is not available on this platform.';
      this.errorSubject.next(message);
      throw new Error(message);
    }

    console.info('[NFC] Read requested');

    if (this.platform.is('ios')) {
      try {
        await NFC.startScan();
      } catch (error) {
        console.error('[NFC] Error starting scan (iOS)', error);
        this.errorSubject.next('Failed to start NFC scan.');
        throw error;
      }
    }

    this.errorSubject.next(null);
  }
}
