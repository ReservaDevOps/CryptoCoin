import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, AlertController } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  shieldHalfOutline,
  lockClosedOutline,
  cloudOfflineOutline,
  radioOutline,
  codeSlash,
  logoGithub,
} from 'ionicons/icons';
import { NfcService } from '../services/nfc.service';
import { CryptoService } from '../services/crypto.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [FormsModule, IonContent, IonIcon],
})
export class HomePage implements OnInit, OnDestroy {
  seedPhrase = '';
  password = '';
  encryptedPayload = '';

  private subscriptions = new Subscription();
  private alertController = inject(AlertController);
  private nfcService = inject(NfcService);
  private cryptoService = inject(CryptoService);

  constructor() {
    addIcons({
      'shield-half-outline': shieldHalfOutline,
      'lock-closed-outline': lockClosedOutline,
      'cloud-offline-outline': cloudOfflineOutline,
      'radio-outline': radioOutline,
      'code-slash': codeSlash,
      'logo-github': logoGithub,
    });
  }

  ngOnInit() {
    this.subscriptions.add(
      this.nfcService.tagRead$.subscribe(payload => {
        if (payload) {
          this.onEncryptedPayload(payload);
        }
      })
    );

    this.subscriptions.add(
      this.nfcService.writeSuccess$.subscribe(() => {
        this.seedPhrase = '';
        this.encryptedPayload = '';
        this.showAlert('Sucesso', 'Dados escritos na tag NFC com sucesso!');
      })
    );

    this.subscriptions.add(
      this.nfcService.error$.subscribe(error => {
        if (error) {
          this.showAlert('Erro de NFC', error);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private onEncryptedPayload(payload: string) {
    this.encryptedPayload = payload;
    if (this.password) {
      this.decryptPayload();
    } else {
      this.showAlert('Tag Lida', 'Dados criptografados capturados. Informe a senha e descriptografe para visualizar.');
    }
  }

  async writeToNFC() {
    if (!this.encryptedPayload) {
      const encrypted = this.encryptSeed();
      if (!encrypted) {
        return;
      }
    }

    try {
      await this.nfcService.write(this.encryptedPayload);
    } catch (error) {
      console.error('Erro ao escrever na NFC', error);
      this.showAlert('Erro de Gravação', 'Não foi possível escrever na tag NFC. Tente novamente.');
    }
  }

  async readFromNFC() {
    try {
      await this.nfcService.read();
    } catch (error) {
      console.error('Erro ao ler da NFC', error);
      this.showAlert('Erro de Leitura', 'Não foi possível ler a tag NFC.');
    }
  }

  encryptSeed(): boolean {
    if (!this.seedPhrase || !this.password) {
      this.showAlert('Campos Necessários', 'Preencha a frase de recuperação e a senha para criptografar.');
      return false;
    }

    try {
      this.encryptedPayload = this.cryptoService.encrypt(this.seedPhrase, this.password);
      this.showAlert('Criptografia', 'Dados criptografados com sucesso. Pronto para gravar na tag.');
      return true;
    } catch (error) {
      console.error('Erro ao criptografar', error);
      this.showAlert('Erro de Criptografia', 'Não foi possível criptografar os dados.');
      return false;
    }
  }

  decryptPayload(): boolean {
    if (!this.encryptedPayload) {
      this.showAlert('Dados Necessários', 'Não há dados criptografados para descriptografar.');
      return false;
    }

    if (!this.password) {
      this.showAlert('Senha Necessária', 'Informe a senha para descriptografar os dados.');
      return false;
    }

    try {
      this.seedPhrase = this.cryptoService.decrypt(this.encryptedPayload, this.password);
      this.showAlert('Descriptografia', 'Dados descriptografados com sucesso. Já é possível copiar a frase.');
      return true;
    } catch (error) {
      console.error('Erro de descriptografia', error);
      this.showAlert('Erro de Descriptografia', 'Não foi possível descriptografar os dados. Verifique a senha.');
      return false;
    }
  }

  async copySeedPhrase() {
    if (!this.seedPhrase) {
      this.showAlert('Nada para copiar', 'Descriptografe a tag antes de copiar a frase.');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.seedPhrase);
        this.showAlert('Copiado', 'Seed phrase copiada para a área de transferência.');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = this.seedPhrase;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.showAlert('Copiado', 'Seed phrase copiada para a área de transferência.');
      }
    } catch (error) {
      console.error('Erro ao copiar seed phrase', error);
      this.showAlert('Erro ao copiar', 'Não foi possível copiar a seed phrase.');
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
