# Build e distribuição Windows x64

Este documento descreve o processo preparado. **Configuração de pipeline não equivale a build homologado.** Confira [VALIDACAO.md](VALIDACAO.md) antes de distribuir.

## Ambiente de desenvolvimento

- Windows 10/11 x64.
- Node.js 24 e npm; `package-lock.json` versionado.
- Rust MSVC; a automação usa Rust **1.99.1**. `Cargo.lock` fixa as dependências nativas.
- Visual Studio C++ Build Tools, workload **Desktop development with C++**, MSVC x64 e Windows SDK.
- Microsoft Edge WebView2 Runtime para executar a janela.

Consulte os [pré-requisitos oficiais do Tauri](https://v2.tauri.app/start/prerequisites/) e as [opções de instalador](https://v2.tauri.app/distribute/windows-installer/). O usuário final não precisa dessas ferramentas de compilação.

## Compilar

No diretório do projeto:

```powershell
npm ci
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run desktop:build
./scripts/package.ps1
```

`desktop:build` especifica `x86_64-pc-windows-msvc` e passa `--locked` ao Cargo. Para uma atualização intencional de dependências nativas, regenere o lockfile, revise o diff e execute novamente as verificações. Versões de compilador, SDK e ferramentas de empacotamento ainda influenciam os binários; não prometemos identidade bit a bit.

Saídas esperadas após build bem-sucedido:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/pulsetrace.exe
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe
artifacts/*-setup.exe
artifacts/PulseTrace-windows-x64-portatil.zip
artifacts/SHA256SUMS.txt
```

O pacote sem instalador inclui `PORTATIL.txt`, que declara sua dependência de WebView2. Não redistribuímos HWiNFO64. O NSIS é configurado para instalação por usuário e para empacotar o instalador offline do WebView2; isso aumenta consideravelmente seu tamanho. Provisionamento do runtime depende das condições do Windows e deve ser testado em máquina limpa.

Não há configuração de certificado Authenticode, thumbprint ou serviço de assinatura. Portanto, **não há declaração de assinatura digital**.

## GitHub Actions

`.github/workflows/ci.yml` executa verificação TypeScript, testes Vitest, build Vite e fluxos Playwright; o job Windows executa formatação/testes Rust, gera NSIS, ZIP e hashes. A amostra pública externa não é baixada automaticamente no pipeline; os testes específicos dela são pulados se o arquivo estiver ausente.

Permissões do workflow: `contents: read`. O workflow publica apenas **artefatos do job**, não GitHub Releases. Não há token de publicação, criação de tags, push ou release automática. O workflow foi preparado localmente e não foi executado em um repositório remoto nesta implementação.

## Homologação antes da primeira release

1. Executar o workflow em um repositório autorizado e inspecionar resultados.
2. Abrir o executável Windows e importar um CSV real do usuário; conferir amostras contra o original.
3. Verificar diálogos nativos, pasta, drag/drop HTML no WebView2, cancelamento e salvamento.
4. Confirmar funcionamento sem rede após instalar o runtime e com HWiNFO64 fechado.
5. Testar Windows 10/11 limpos com e sem WebView2; verificar dependências VC runtime/SDK efetivamente vinculadas, além do WebView2.
6. Testar instalação por usuário, abertura e desinstalação; confirmar que os registros originais não são alterados.
7. Validar PDF/HTML/PNG e nomes Unicode nos arquivos; revisar limites de memória com arquivos próximos ao limite.
8. Somente com autorização explícita, criar uma release e anexar os artefatos e `SHA256SUMS.txt`.

O script de pacote prepara hashes com SHA-256. Para conferir um download em PowerShell:

```powershell
Get-FileHash -LiteralPath '.\PulseTrace-windows-x64-portatil.zip' -Algorithm SHA256
```

Compare com o manifesto da mesma release. Um checksum detecta divergência, mas não substitui assinatura/autenticidade da fonte.

## Ferramentas locais usadas na implementação

O ambiente original tinha Node.js, mas não `cargo` no PATH nem a instalação padrão de Visual Studio Build Tools. Foi instalado um toolchain Rust mínimo em `.tools/`, com checksum do instalador verificado e sem alterar o PATH global. Esse diretório é ignorado pelo Git e não é parte do produto.

Para usar essa cópia no workspace atual, caso ela ainda exista:

```powershell
$env:RUSTUP_HOME = Join-Path (Get-Location) '.tools\rustup'
$env:CARGO_HOME = Join-Path (Get-Location) '.tools\cargo'
$env:PATH = "$env:CARGO_HOME\bin;$env:PATH"
```

Isso não instala MSVC nem Windows SDK. A compilação do host Windows continua dependente dessas ferramentas.
