import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonTextarea,
  IonInput,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  AlertController,
} from '@ionic/angular/standalone';
import * as CryptoJS from 'crypto-js';
import { Subscription } from 'rxjs';
import { NfcService } from '../services/nfc.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonTextarea,
    IonInput,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  seedPhrase: string = '';
  password: string = '';

  private subscriptions = new Subscription();

  constructor(
    private alertController: AlertController,
    private nfcService: NfcService
  ) {}

  ngOnInit() {
    this.subscriptions.add(
      this.nfcService.tagRead$.subscribe(tag => {
        if (tag) {
          this.handleNfcTag(tag);
        }
      })
    );

    this.subscriptions.add(
      this.nfcService.writeSuccess$.subscribe(() => {
        this.showAlert('Success', 'Data written to NFC tag successfully!');
      })
    );

    this.subscriptions.add(
      this.nfcService.error$.subscribe(error => {
        if (error) {
          this.showAlert('NFC Error', error);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  handleNfcTag(tag: any) {
    if (this.password) {
      try {
        const encryptedData = tag.ndefMessage;
        if (encryptedData) {
          this.decryptAndSetSeed(encryptedData);
        } else {
          this.showAlert('Empty Tag', 'The NFC tag is empty.');
        }
      } catch (e) {
        console.error('Read error', e);
        this.showAlert('Read Error', 'Could not read data from the NFC tag.');
      }
    } else {
      this.showAlert('Password Required', 'Please enter the password to decrypt the tag data.');
    }
  }

  async writeToNFC() {
    if (!this.seedPhrase || !this.password) {
      this.showAlert('Required Fields', 'Please fill in the recovery phrase and password.');
      return;
    }

    try {
      const encryptedData = CryptoJS.AES.encrypt(this.seedPhrase, this.password).toString();
      await this.nfcService.write(encryptedData);
    } catch (error) {
      console.error('Error writing to NFC', error);
      this.showAlert('Write Error', 'Could not write to the NFC tag. Please try again.');
    }
  }

  async readFromNFC() {
    try {
      await this.nfcService.read();
    } catch (error) {
      console.error('Error reading from NFC', error);
      this.showAlert('Read Error', 'Could not read from the NFC tag.');
    }
  }

  private decryptAndSetSeed(encryptedData: string) {
    if (!this.password) {
      this.showAlert('Password Required', 'Please enter the password to decrypt the data.');
      return;
    }
    try {
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, this.password);
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);

      if (decryptedText) {
        this.seedPhrase = decryptedText;
        this.showAlert('Success', 'Data read and decrypted successfully!');
      } else {
        throw new Error('Incorrect password or corrupted data.');
      }
    } catch (e) {
      console.error('Decryption error', e);
      this.showAlert('Decryption Error', 'Could not decrypt the data. Check the password and try again.');
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
