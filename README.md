# CryptoCoin

Este é um aplicativo móvel desenvolvido com Ionic e Angular, projetado para armazenar com segurança sua frase de recuperação de criptomoeda (seed phrase) em uma tag NFC. O aplicativo utiliza criptografia AES para garantir que seus dados permaneçam privados e seguros.

## Funcionalidades

- **Criptografia Segura**: Criptografa sua seed phrase usando uma senha que você define.
- **Armazenamento em NFC**: Grava a seed phrase criptografada em uma tag NFC.
- **Leitura de NFC**: Lê a seed phrase criptografada de uma tag NFC e a descriptografa.

## Tecnologias Utilizadas

- **Ionic/Angular**: Framework para desenvolvimento de aplicativos móveis multiplataforma.
- **Capacitor**: Plataforma para execução de aplicativos web em dispositivos móveis com acesso a APIs nativas.
- **Capacitor NFC Plugin**: Plugin para interação com a funcionalidade NFC do dispositivo.
- **CryptoJS**: Biblioteca para criptografia e descriptografia dos dados.

## Requisitos

- Node.js 20+ (use [nvm](https://github.com/nvm-sh/nvm) se possível)
- npm ou yarn
- Ionic CLI:
  ```bash
  npm install -g @ionic/cli
  ```

## Como Rodar o Projeto

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/ReservaDevOps/CryptoCoin.git
   ```
2. **Instale as dependências**:
   ```bash
   cd cryptocoin
   npm install
   ```
3. **Rodar no navegador (modo desenvolvimento)**
   ```bash 
   ionic serve
   ```
4. **Build para produção (PWA ou web)**:
   ```bash
   ionic build
   ```
5. **Execute o projeto em um dispositivo ou emulador**:

   Compile o projeto Angular:
   ```bash
   ionic build
   ```
   Sincronize com o Capacitor:
   ```bash
   npx cap sync
   ```
   Sincronize com o Capacitor:
   ```bash
   npx cap open android
   ```

## Como Usar

### Pré-requisitos

- Dispositivo móvel com suporte a NFC.
- Tag NFC para gravação dos dados.

### Passos

1. **Instale o aplicativo** em seu dispositivo móvel.
2. **Abra o aplicativo** e você verá a tela principal.
3. **Para gravar uma seed phrase**:
   - Insira sua seed phrase no campo "Seed Phrase".
   - Crie e insira uma senha no campo "Senha".
   - Clique no botão "Gravar na Tag NFC".
   - Aproxime a tag NFC do seu dispositivo para gravar os dados.
4. **Para ler uma seed phrase**:
   - Insira a senha que você usou para criptografar os dados.
   - Clique no botão "Ler da Tag NFC".
   - Aproxime a tag NFC do seu dispositivo para ler os dados.
   - A seed phrase será exibida no campo "Seed Phrase".

## Estrutura do Projeto

O projeto segue a estrutura padrão de um aplicativo Ionic/Angular. Os principais arquivos estão localizados em `src/app`.

- `src/app/home/home.page.ts`: Contém a lógica principal do aplicativo, incluindo as funções de criptografia, descriptografia, leitura e gravação de NFC.
- `src/app/home/home.page.html`: Define a interface do usuário do aplicativo.

## Scripts Disponíveis

No diretório do projeto, você pode executar:

- `npm start`: Inicia o servidor de desenvolvimento.
- `npm run build`: Compila o aplicativo para produção.
- `npm test`: Executa os testes unitários.
- `npm run lint`: Analisa o código em busca de erros de estilo.

## Autor

[Ionic Framework](https://ionicframework.com/)

## Licença

Este projeto está licenciado sob a [Licença Pública Geral GNU v3.0](https://www.gnu.org/licenses/gpl-3.0.html).
