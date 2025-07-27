import { Component } from '@angular/core';
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
  Platform,
} from '@ionic/angular/standalone';
import { Nfc } from 'capacitor-nfc-plugin';
import * as CryptoJS from 'crypto-js';

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
export class HomePage {
  seedPhrase: string = '';
  password: string = '';

  constructor(private alertController: AlertController, private platform: Platform) {
    this.addNfcListeners();
  }

  addNfcListeners() {
    if (this.platform.is('capacitor')) {
      Nfc.addListener('nfcStatus', (status) => {
        if (status.status !== 'enabled') {
          this.showAlert('Erro', 'NFC não está ativado.');
        }
      });

      Nfc.addListener('nfcTagDetected', (tag) => {
        this.handleNfcTag(tag);
      });

      Nfc.addListener('readSuccess', (tag) => {
        this.handleNfcTag(tag);
      });

      Nfc.addListener('writeSuccess', () => {
        this.showAlert('Sucesso', 'Dados gravados na tag NFC com sucesso!');
      });

      Nfc.addListener('writeError', (error) => {
        console.error('Error writing to NFC', error);
        this.showAlert('Erro de Gravação', 'Não foi possível gravar na tag NFC. Tente novamente.');
      });

      Nfc.addListener('nfcError', (error) => {
        console.error('NFC Error', error);
        this.showAlert('Erro de NFC', 'Ocorreu um erro de NFC.');
      });
    }
  }

  handleNfcTag(tag: any) {
    if (this.password) {
      try {
        const ndefMessage = tag.ndefMessage;
        if (ndefMessage && ndefMessage.length > 0) {
          const record = ndefMessage[0];
          const encryptedData = record.payload;
          this.decryptAndSetSeed(encryptedData);
        } else {
          this.showAlert('Tag Vazia', 'A tag NFC lida está vazia.');
        }
      } catch (e) {
        console.error('Read error', e);
        this.showAlert('Erro de Leitura', 'Não foi possível ler os dados da tag NFC.');
      }
    } else {
      this.showAlert('Senha Necessária', 'Por favor, insira a senha para descriptografar os dados da tag.');
    }
  }

  async writeToNFC() {
    if (!this.seedPhrase || !this.password) {
      this.showAlert('Campos Obrigatórios', 'Por favor, preencha a frase de recuperação e a senha.');
      return;
    }

    if (this.platform.is('capacitor')) {
      try {
        const encryptedData = CryptoJS.AES.encrypt(this.seedPhrase, this.password).toString();
        await Nfc.write({ text: encryptedData });
      } catch (error) {
        console.error('Error writing to NFC', error);
        this.showAlert('Erro de Gravação', 'Não foi possível gravar na tag NFC. Tente novamente.');
      }
    } else {
      this.showAlert('Erro', 'NFC não está disponível nesta plataforma.');
    }
  }

  async readFromNFC() {
    if (this.platform.is('capacitor')) {
      try {
        await Nfc.read();
      } catch (error) {
        console.error('Error reading from NFC', error);
        this.showAlert('Erro de Leitura', 'Não foi possível ler os dados da tag NFC.');
      }
    } else {
      this.showAlert('Erro', 'NFC não está disponível nesta plataforma.');
    }
  }

  private decryptAndSetSeed(encryptedData: string) {
    if (!this.password) {
      this.showAlert('Senha Necessária', 'Por favor, insira a senha para descriptografar os dados.');
      return;
    }
    try {
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, this.password);
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);

      if (decryptedText) {
        this.seedPhrase = decryptedText;
        this.showAlert('Sucesso', 'Dados lidos e descriptografados com sucesso!');
      } else {
        throw new Error('Senha incorreta ou dados corrompidos.');
      }
    } catch (e) {
      console.error('Decryption error', e);
      this.showAlert('Erro de Descriptografia', 'Não foi possível descriptografar os dados. Verifique a senha e tente novamente.');
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
