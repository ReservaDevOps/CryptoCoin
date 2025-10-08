import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { IonContent, IonIcon, IonModal, AlertController, IonButton, IonToggle } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { Clipboard } from '@capacitor/clipboard';
import {
  shieldHalfOutline,
  lockClosedOutline,
  cloudOfflineOutline,
  radioOutline,
  codeSlash,
  logoGithub,
  copyOutline,
  eyeOutline,
  eyeOffOutline,
  radio,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { NfcService } from '../services/nfc.service';
import { CryptoService, EncryptionAlgorithm, EncryptOptions, EncryptionResult } from '../services/crypto.service';

interface EncryptionOption {
  id: EncryptionAlgorithm;
  label: string;
  description: string;
}

type DecryptFeedback = {
  showSuccess: boolean;
  showErrors: boolean;
};

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, IonContent, IonIcon, IonModal, IonButton, IonToggle],
})
export class HomePage implements OnInit, OnDestroy {
  seedPhrase = '';
  password = '';
  encryptedPayload = '';
  passwordVisible = false;

  isReadModalOpen = false;
  isWriteModalOpen = false;
  showReadSuccess = false;
  showWriteSuccess = false;
  verificationInProgress = false;
  verificationMessage = '';

  encryptionMode: EncryptionAlgorithm = 'aes-gcm';
  compressionEnabled = false;
  autoVerifyWrite = true;

  encryptedPreviewBytes: number | null = null;
  encryptionError: string | null = null;
  isComputingEncryption = false;

  encryptionOptions: EncryptionOption[] = [
    {
      id: 'aes-gcm',
      label: 'AES-GCM 256 (recomendado)',
      description: 'Autenticação integrada (GCM) com IV de 96 bits.',
    },
    {
      id: 'aes-cbc',
      label: 'AES-CBC 256 + HMAC-SHA256',
      description: 'Compatível com ambientes legados que exigem CBC.',
    },
  ];

  latestEncryptionResult?: EncryptionResult;

  @ViewChild('passwordInput', { static: false }) passwordInput?: ElementRef<HTMLInputElement>;

  private subscriptions = new Subscription();
  private alertController = inject(AlertController);
  private nfcService = inject(NfcService);
  private cryptoService = inject(CryptoService);

  private updatingEncryptedFromEncrypt = false;
  private updatingEncryptedFromRead = false;
  private lastWritePayload: string | null = null;
  private awaitingVerification = false;
  private previewCache = new Map<string, EncryptionResult>();
  private encryptionComputationToken = 0;

  constructor() {
    addIcons({
      'shield-half-outline': shieldHalfOutline,
      'lock-closed-outline': lockClosedOutline,
      'cloud-offline-outline': cloudOfflineOutline,
      'radio-outline': radioOutline,
      'code-slash': codeSlash,
      'logo-github': logoGithub,
      'copy-outline': copyOutline,
      'eye-outline': eyeOutline,
      'eye-off-outline': eyeOffOutline,
      radio,
      'checkmark-circle-outline': checkmarkCircleOutline,
    });
  }

  get selectedEncryptionOption(): EncryptionOption | undefined {
    return this.encryptionOptions.find(option => option.id === this.encryptionMode);
  }

  ngOnInit() {
    this.subscriptions.add(
      this.nfcService.tagRead$.subscribe(payload => {
        if (payload) {
          this.onEncryptedPayloadFromTag(payload);
        }
      })
    );

    this.subscriptions.add(
      this.nfcService.writeSuccess$.subscribe(() => {
        void this.handleWriteSuccess();
      })
    );

    this.subscriptions.add(
      this.nfcService.error$.subscribe(error => {
        if (error) {
          this.closeReadModal();
          this.closeWriteModal();
          this.showAlert('Erro de NFC', error);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.resetWriteVerificationState();
  }

  async writeToNFC() {
    if (!this.encryptedPayload) {
      await this.computeEncryptionVariants(true);
      if (!this.encryptedPayload) {
        this.showAlert('Campos Necessários', 'Informe a frase de recuperação e a senha para gerar o conteúdo antes de gravar.');
        return;
      }
    }

    this.lastWritePayload = this.encryptedPayload;
    this.awaitingVerification = this.autoVerifyWrite;
    this.openWriteModal();

    try {
      await this.nfcService.write(this.encryptedPayload);
    } catch (error) {
      console.error('Erro ao escrever na NFC', error);
      this.closeWriteModal();
      this.showAlert('Erro de Gravação', 'Não foi possível escrever na tag NFC. Tente novamente.');
      this.resetWriteVerificationState();
    }
  }

  async readFromNFC() {
    this.openReadModal();
    try {
      await this.nfcService.read();
    } catch (error) {
      console.error('Erro ao ler da NFC', error);
      this.closeReadModal();
      this.showAlert('Erro de Leitura', 'Não foi possível ler a tag NFC.');
    }
  }

  async copySeedPhrase() {
    if (!this.seedPhrase) {
      this.showAlert('Nada para copiar', 'Descriptografe a tag antes de copiar a frase.');
      return;
    }
    await this.copyToClipboard(this.seedPhrase, 'Seed phrase copiada para a área de transferência.');
  }

  async copyEncryptedPayload() {
    if (!this.encryptedPayload) {
      this.showAlert('Nada para copiar', 'Não há dados criptografados disponíveis.');
      return;
    }
    await this.copyToClipboard(this.encryptedPayload, 'Dados criptografados copiados para a área de transferência.');
  }

  onSeedPhraseChange() {
    void this.computeEncryptionVariants(true);
  }

  onPasswordChange() {
    void this.computeEncryptionVariants(true);
    if (this.encryptedPayload) {
      void this.decryptPayload({ showSuccess: false, showErrors: false });
    }
  }

  onEncryptedPayloadInput() {
    if (this.updatingEncryptedFromEncrypt) {
      return;
    }

    if (this.updatingEncryptedFromRead) {
      this.updatingEncryptedFromRead = false;
      this.encryptedPreviewBytes = this.encryptedPayload ? this.encryptedPayload.length : null;
      if (this.password) {
        void this.decryptPayload({ showSuccess: true, showErrors: true });
      }
      return;
    }

    this.previewCache.clear();
    this.encryptedPreviewBytes = this.encryptedPayload ? this.encryptedPayload.length : null;
    if (this.password && this.encryptedPayload) {
      void this.decryptPayload({ showSuccess: false, showErrors: false });
    }
  }

  togglePasswordVisibility() {
    const input = this.passwordInput?.nativeElement;
    if (!input) {
      return;
    }

    this.passwordVisible = !this.passwordVisible;
    input.type = this.passwordVisible ? 'text' : 'password';
  }

  onAlgorithmChange(algorithm: EncryptionAlgorithm) {
    if (this.encryptionMode === algorithm) {
      return;
    }

    this.encryptionMode = algorithm;
    this.handleVariantSelectionChange();
  }

  onCompressionChange(enabled: boolean) {
    if (this.compressionEnabled === enabled) {
      return;
    }

    this.compressionEnabled = enabled;
    this.handleVariantSelectionChange();
  }

  private handleVariantSelectionChange() {
    if (this.previewCache.size && this.seedPhrase && this.password) {
      this.updatePreviewMetrics(true);
      return;
    }

    if (this.seedPhrase && this.password) {
      void this.computeEncryptionVariants(true);
      return;
    }

    this.updatePreviewMetrics(false);
  }

  formatBytes(algorithm: EncryptionAlgorithm, compress: boolean): string {
    const result = this.previewCache.get(this.variantKey(algorithm, compress));
    if (result) {
      return `${result.byteLength} bytes`;
    }
    if (this.isComputingEncryption && this.seedPhrase && this.password) {
      return 'calculando...';
    }
    return '--';
  }

  private async computeEncryptionVariants(applyToSelected: boolean) {
    const token = ++this.encryptionComputationToken;

    if (!this.seedPhrase || !this.password) {
      this.previewCache.clear();
      this.encryptionError = null;
      this.encryptedPreviewBytes = null;
      this.latestEncryptionResult = undefined;
      if (applyToSelected) {
        this.updatingEncryptedFromEncrypt = true;
        this.encryptedPayload = '';
        this.updatingEncryptedFromEncrypt = false;
      }
      return;
    }

    this.isComputingEncryption = true;

    const combos: EncryptOptions[] = [];
    for (const option of this.encryptionOptions) {
      combos.push({ algorithm: option.id, compress: false });
      combos.push({ algorithm: option.id, compress: true });
    }

    const newCache = new Map<string, EncryptionResult>();

    try {
      for (const combo of combos) {
        const result = await this.cryptoService.encrypt(this.seedPhrase, this.password, combo);
        if (token !== this.encryptionComputationToken) {
          this.isComputingEncryption = false;
          return;
        }
        newCache.set(this.variantKey(combo.algorithm, combo.compress), result);
      }
    } catch (error) {
      if (token !== this.encryptionComputationToken) {
        return;
      }
      console.error('Erro ao criptografar', error);
      this.previewCache.clear();
      this.encryptionError = 'Não foi possível criptografar os dados com as opções selecionadas.';
      this.isComputingEncryption = false;
      return;
    }

    if (token !== this.encryptionComputationToken) {
      this.isComputingEncryption = false;
      return;
    }

    this.previewCache = newCache;
    this.encryptionError = null;
    this.isComputingEncryption = false;
    this.updatePreviewMetrics(applyToSelected);
  }

  private updatePreviewMetrics(applyToSelected: boolean) {
    const key = this.variantKey(this.encryptionMode, this.compressionEnabled);
    const result = this.previewCache.get(key);
    this.latestEncryptionResult = result;
    this.encryptedPreviewBytes = result?.byteLength ?? null;

    if (applyToSelected) {
      this.updatingEncryptedFromEncrypt = true;
      this.encryptedPayload = result?.payload ?? '';
      this.updatingEncryptedFromEncrypt = false;
    }
  }

  private variantKey(algorithm: EncryptionAlgorithm, compress: boolean): string {
    return `${algorithm}-${compress ? '1' : '0'}`;
  }

  private async handleWriteSuccess() {
    if (!this.isWriteModalOpen) {
      return;
    }

    if (this.awaitingVerification && this.lastWritePayload) {
      this.verificationInProgress = true;
      this.verificationMessage = 'Verificando leitura da tag...';
      try {
        const readBack = await this.nfcService.readOnce(6000);
        const matches = readBack === this.lastWritePayload;
        this.showWriteSuccess = matches;
        this.verificationMessage = matches
          ? 'Leitura confirmada. Conteúdo corresponde ao gravado.'
          : 'A leitura não corresponde ao conteúdo gravado.';
        if (matches) {
          this.showAlert('Gravação confirmada', 'Tag NFC gravada e validada com sucesso.');
        } else {
          this.showAlert('Verificação falhou', 'O conteúdo lido não coincide com o texto gravado.');
        }
      } catch (error) {
        console.error('Falha na verificação da escrita', error);
        this.verificationMessage = 'Não foi possível confirmar a gravação. Aproxime a tag novamente e tente ler.';
        this.showAlert('Verificação pendente', 'Não conseguimos confirmar a escrita automaticamente.');
      } finally {
        this.verificationInProgress = false;
        this.resetWriteVerificationState();
        if (this.showWriteSuccess) {
          setTimeout(() => this.closeWriteModal(), 1400);
        }
      }
      return;
    }

    this.showWriteSuccess = true;
    this.resetWriteVerificationState();
    setTimeout(() => this.closeWriteModal(), 1400);
  }

  private onEncryptedPayloadFromTag(payload: string) {
    this.onEncryptedPayload(payload);
    this.handleReadSuccess();
  }

  private onEncryptedPayload(payload: string) {
    this.previewCache.clear();
    this.encryptedPreviewBytes = payload.length;
    this.updatingEncryptedFromRead = true;
    this.encryptedPayload = payload;
    if (this.password) {
      void this.decryptPayload({ showSuccess: true, showErrors: true });
    }
  }

  private handleReadSuccess() {
    if (!this.isReadModalOpen) {
      return;
    }
    this.showReadSuccess = true;
    setTimeout(() => this.closeReadModal(), 1400);
  }

  private openReadModal() {
    this.showReadSuccess = false;
    this.isReadModalOpen = true;
  }

  protected closeReadModal() {
    this.isReadModalOpen = false;
    this.showReadSuccess = false;
  }

  private openWriteModal() {
    this.showWriteSuccess = false;
    this.verificationMessage = this.autoVerifyWrite ? 'Mantenha a tag próxima para verificar a gravação.' : '';
    this.verificationInProgress = false;
    this.isWriteModalOpen = true;
  }

  protected closeWriteModal() {
    this.isWriteModalOpen = false;
    this.showWriteSuccess = false;
    this.verificationInProgress = false;
    this.verificationMessage = '';
  }

  private resetWriteVerificationState() {
    this.awaitingVerification = false;
    this.lastWritePayload = null;
  }

  private async decryptPayload({ showSuccess, showErrors }: DecryptFeedback): Promise<boolean> {
    if (!this.encryptedPayload) {
      if (showErrors) {
        this.showAlert('Dados Necessários', 'Não há dados criptografados para descriptografar.');
      }
      return false;
    }

    if (!this.password) {
      if (showErrors) {
        this.showAlert('Senha Necessária', 'Informe a senha para descriptografar os dados.');
      }
      return false;
    }

    try {
      this.seedPhrase = await this.cryptoService.decrypt(this.encryptedPayload, this.password);
      if (showSuccess) {
        this.showAlert('Descriptografia', 'Dados descriptografados com sucesso. Já é possível copiar a frase.');
      }
      void this.computeEncryptionVariants(false);
      return true;
    } catch (error) {
      console.error('Erro de descriptografia', error);
      if (showErrors) {
        this.showAlert('Erro de Descriptografia', 'Não foi possível descriptografar os dados. Verifique a senha.');
      }
      return false;
    }
  }

  private async copyToClipboard(value: string, successMessage: string) {
    try {
      await Clipboard.write({ string: value });
      this.showAlert('Copiado', successMessage);
      return;
    } catch (pluginError) {
      console.warn('Clipboard plugin fallback', pluginError);
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        this.showAlert('Copiado', successMessage);
        return;
      }
    } catch (apiError) {
      console.error('Erro ao copiar texto (navigator)', apiError);
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showAlert('Copiado', successMessage);
    } catch (fallbackError) {
      console.error('Erro ao copiar texto (fallback)', fallbackError);
      this.showAlert('Erro ao copiar', 'Não foi possível copiar o conteúdo.');
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
