import { NgZone } from '@angular/core';
import { Platform } from '@ionic/angular';
import { NfcService } from './nfc.service';
import { NfcMockService } from './nfc.mock.service';

export function nfcServiceFactory(platform: Platform, ngZone: NgZone): NfcService | NfcMockService {
  if (platform.is('capacitor')) {
    console.log('Providing real NfcService');
    return new NfcService(platform, ngZone);
  } else {
    console.log('Providing mock NfcMockService');
    return new NfcMockService(ngZone);
  }
}
