/* eslint-disable @angular-eslint/prefer-inject */
import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { BehaviorSubject, Subject } from 'rxjs';
import { NFC, NDEFMessagesTransformable, NFCError } from '@exxili/capacitor-nfc';

type PendingRead = {
  resolve: (payload: string) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

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

  private listenersRegistered = false;
  private pendingReads = new Set<PendingRead>();
  private readonly textDecoder = new TextDecoder();
  private readonly textEncoder = new TextEncoder();

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
          this.resolvePendingReads(payload);
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
      this.ngZone.run(() => {
        const message = error?.error ?? 'An NFC error occurred.';
        this.errorSubject.next(message);
        this.rejectPendingReads(new Error(message));
      });
    });
  }

  private extractPayload(data: NDEFMessagesTransformable): string | null {
    try {
      const messages = data.uint8Array().messages;
      const record = messages?.[0]?.records?.[0];
      const payload = record?.payload;
      if (!payload || !(payload instanceof Uint8Array)) {
        return null;
      }

      if ((record.type === 'T' || record.type === 'text') && payload.length > 0) {
        const status = payload[0];
        const langLength = status & 0x3f;
        const textStart = 1 + langLength;
        if (textStart > 0 && textStart <= payload.length) {
          const textBytes = payload.slice(textStart);
          return this.textDecoder.decode(textBytes);
        }
      }

      return this.textDecoder.decode(payload);
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

    const languageCode = 'en';
    const langBytes = this.textEncoder.encode(languageCode);
    const dataBytes = this.textEncoder.encode(data);
    const payloadBytes = new Uint8Array(1 + langBytes.length + dataBytes.length);
    payloadBytes[0] = langBytes.length & 0x3f;
    payloadBytes.set(langBytes, 1);
    payloadBytes.set(dataBytes, 1 + langBytes.length);

    try {
      await NFC.writeNDEF({
        records: [
          {
            type: 'T',
            payload: Array.from(payloadBytes),
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

  async readOnce(timeoutMs = 8000): Promise<string> {
    if (!this.isNative) {
      throw new Error('NFC is not available on this platform.');
    }

    await this.read();

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingReads.delete(entry);
        reject(new Error('Timeout waiting for NFC tag.'));
      }, timeoutMs);

      const entry: PendingRead = {
        resolve: payload => {
          clearTimeout(timeout);
          this.pendingReads.delete(entry);
          resolve(payload);
        },
        reject: error => {
          clearTimeout(timeout);
          this.pendingReads.delete(entry);
          reject(error);
        },
        timeout,
      };

      this.pendingReads.add(entry);
    });
  }

  private resolvePendingReads(payload: string) {
    if (this.pendingReads.size === 0) {
      return;
    }
    const entries = Array.from(this.pendingReads);
    this.pendingReads.clear();
    entries.forEach(entry => {
      clearTimeout(entry.timeout);
      entry.resolve(payload);
    });
  }

  private rejectPendingReads(error: Error) {
    if (this.pendingReads.size === 0) {
      return;
    }
    const entries = Array.from(this.pendingReads);
    this.pendingReads.clear();
    entries.forEach(entry => {
      clearTimeout(entry.timeout);
      entry.reject(error);
    });
  }
}
