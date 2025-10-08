/* eslint-disable @angular-eslint/prefer-inject */
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

type PendingRead = {
  resolve: (payload: string) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

@Injectable({
  providedIn: 'root'
})
export class NfcMockService {
  private mockTagContent: string | null = null;

  private tagReadSubject = new BehaviorSubject<string | null>(null);
  tagRead$ = this.tagReadSubject.asObservable();

  private writeSuccessSubject = new Subject<void>();
  writeSuccess$ = this.writeSuccessSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  private pendingReads = new Set<PendingRead>();

  constructor(private ngZone: NgZone) {
    console.info('[NFC MOCK] Service initialized');
  }

  write(data: string): void {
    console.info('[NFC MOCK] Writing data:', data);
    setTimeout(() => {
      this.mockTagContent = data;
      this.ngZone.run(() => {
        this.writeSuccessSubject.next();
        this.errorSubject.next(null);
      });
    }, 150);
  }

  async read(): Promise<void> {
    console.info('[NFC MOCK] Reading data...');
    setTimeout(() => {
      this.ngZone.run(() => {
        if (this.mockTagContent) {
          this.tagReadSubject.next(this.mockTagContent);
          this.errorSubject.next(null);
          this.resolvePendingReads(this.mockTagContent);
        } else {
          const error = 'Mock NFC tag is empty.';
          this.errorSubject.next(error);
          this.rejectPendingReads(new Error(error));
        }
      });
    }, 150);
    return Promise.resolve();
  }

  async readOnce(timeoutMs = 8000): Promise<string> {
    await this.read();
    return new Promise((resolve, reject) => {
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
