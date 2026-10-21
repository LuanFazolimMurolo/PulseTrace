# Validação executada

Registro da implementação em **20/10/2026**, Windows x64. Este documento separa testes de código, execução no navegador e validação nativa. A primeira release Windows ainda **não está homologada**.

## Ambiente

- Node.js 24.17.0 / npm 11.13.0.
- TypeScript 5.9, Vite 7, Vitest 5, Playwright/Chromium instalados pelo lockfile.
- Rust 1.99.1 instalado isoladamente em `.tools/`, sem alterar PATH global.
- Linker MSVC `link.exe` ausente; Visual Studio Build Tools e Windows SDK não encontrados nas localizações padrão.

## Resultados

| Verificação | Evidência / resultado |
|---|---|
| `npm run check` | TypeScript estrito e suíte do núcleo; ver histórico de execução abaixo. |
| `npm run build` | Bundle frontend de produção gerado em `dist/`. |
| `npm run test:e2e` | Fluxos Chromium executados; ver detalhes abaixo. |
| `npm audit` | Zero vulnerabilidades após atualização do Vitest. Resultado é pontual, não garantia futura. |
| `tauri icon` | Ícones gerados a partir de `scripts/icon.svg`. |
| `cargo generate-lockfile` | `src-tauri/Cargo.lock` gerado com 421 pacotes resolvidos. |
| `cargo fmt --check` | Formatação Rust verificada. |
| `cargo check --locked` | **Bloqueado:** `error: linker link.exe not found`, ao compilar dependências. O host Tauri não foi compilado. |
| `npm run desktop:build` inicial | **Bloqueado:** `cargo metadata ... program not found` antes da instalação isolada de Rust. |
| Instalador NSIS / ZIP / SHA-256 | Scripts e pipeline preparados; **não gerados**, pois dependem do executável. |
| Executável em Windows 10/11 | **Não executado.** |
| GitHub Actions remoto | **Não executado.** Nenhum push, tag ou release. |

O build Vite informa um chunk ECharts com aproximadamente 560 kB antes de gzip. É uma advertência de tamanho, não uma falha; os assets são locais no desktop. O jsPDF é carregado sob demanda. O comportamento com o limite máximo de memória não foi homologado.

## Cobertura do núcleo

Testes exercitam CSV válido, vazio, sem colunas de data, truncado, linhas com colunas excessivas, cabeçalhos duplicados, grupos de dispositivo, sensores ausentes, valores inválidos, UTF-16 e Windows-1252, delimitadores, aspas e quebras entre blocos, limites de campo/coluna/tamanho, progresso, 100.000 amostras, diferentes formatos de data, AM/PM, segundos sem zero à esquerda, fuso explícito, timestamps repetidos/fora de ordem e datas impossíveis.

Regras testadas com casos positivos e negativos: temperatura persistente, picos, ausência de dados interrompendo duração, lacunas, throttling explícito, uso de memória, variação de potência, identidade/carga exigidas na correlação de clock, intervalo sem leituras e inexistência de diagnóstico físico a partir de atividade de disco. Investigação não usa leituras futuras. Eventos exigem fuso. Comparação não preenche ausentes com zero.

Exportação testa escaping HTML, neutralização de fórmulas de planilha, intervalo filtrado, ausências, documento PDF com assinatura `%PDF`, reimportação do CSV normalizado e temperaturas negativas. Isso não equivale a uma inspeção visual exaustiva de todos os PDFs.

O teste de 100.000 amostras cobre mais de 55 horas a cada dois segundos, com duas colunas de sensores. Não representa uma homologação de CSVs de 64 MiB ou do limite de seis milhões de valores.

## Fluxos de interface

Playwright executa em Chromium, usando o mesmo frontend do desktop e o adaptador de arquivos do navegador:

1. Boas-vindas, demonstração, páginas de componentes, canvas, PNG, marcadores, comparação de intervalos, investigação, diagnóstico e tema claro.
2. Importação CSV pelo input, mudança de intervalo, exportação HTML/PDF/CSV.
3. Duas sessões, comparação e remoção da memória.
4. Mensagem de arquivo vazio, drag/drop e layout com 900 px sem overflow horizontal.
5. Cancelamento de um arquivo sintético com 200.000 linhas.
6. Teste opcional do arquivo externo abaixo, pelo worker e páginas de sensores/diagnóstico.

Capturas `docs/screenshots/boas-vindas.png` e `dashboard.png` foram obtidas dessa execução. O dashboard contém dados sintéticos identificados. Não são screenshots do executável Windows.

Uma primeira rodada encontrou ambiguidade no seletor de teste “Memória” (título da página e título de gráfico); o seletor foi corrigido para nível 1. Uma rodada posterior teve timeout de navegação em `page.goto` com build/downloads concorrentes; os demais fluxos passaram. A rodada final é executada sequencialmente, sem editar o código durante os testes.

## Arquivo externo de HWiNFO

Foi baixado um CSV publicamente apresentado como registro do HWiNFO: [hwinfo_report_20240508.csv, publicado por aminebeh](https://gist.github.com/aminebeh/0e78ea755f721671a0d4684da3716182), revisão `8a34bc44b8fe19fd8968c63037675bc68278b4eb`.

| Propriedade | Resultado |
|---|---|
| Tamanho | 225.447 bytes |
| SHA-256 | `859bd8b20a3ced81b173244afb7173569cc54a89d09115d9745e76d7195905e5` |
| Leituras aceitas | 123 de 123 |
| Colunas de sensores | 376 |
| Codificação / delimitador | UTF-8 / vírgula |
| Início / fim textual | 08/05/2024 19:30:23.473 — 19:34:40.281 |
| Cadência mediana | 2.008 ms |
| Timestamps inválidos | 0 |
| Valores inválidos / ausentes | 0 / 0 |
| Timestamps repetidos / fora de ordem | 0 / 0 |
| Identidades de coluna | Únicas, com ocorrências duplicadas preservadas |

O arquivo não informa fuso: UTC foi escolhido **apenas para a validação do parser**, não como afirmação do fuso real da máquina de origem. O teste verifica categorias de CPU, GPU, memória e armazenamento e presença de números. A versão exata do HWiNFO e a autenticidade física das medições não foram confirmadas independentemente. Cabeçalhos sem dispositivo continuam ambíguos, conforme alertado na interface.

Essa amostra revelou segundos não preenchidos, como `19:31:1.643`, e motivou uma correção de parsing. A compatibilidade demonstrada é **limitada a este arquivo**. Não se afirma compatibilidade universal ou precisão de diagnóstico físico a partir dele.

O CSV foi mantido em `tests/private/`, ignorado pelo Git. Não é redistribuído no código nem baixado automaticamente nos testes. Para repetir a validação, baixe manualmente a revisão indicada para `tests/private/hwinfo_report_20240508.csv` e execute:

```powershell
npx vitest run tests/unit/real-file.test.ts --reporter=verbose --silent=false
npm run test:e2e
```

Sem esse arquivo, os testes externos são explicitamente pulados; a suíte sintética continua independente e local.

## Pendências para homologação

- Compilar e abrir Tauri após instalar MSVC/Windows SDK; validar permissões de arquivos e CSP no WebView2 real.
- Diálogos nativos, seleção de pasta e salvamento nativo não foram exercitados por Playwright.
- Instalar/desinstalar NSIS em Windows 10/11 limpos; confirmar provisionamento WebView2 offline e dependências nativas do ZIP.
- Executar pipeline remoto somente após configurar um repositório autorizado.
- Ampliar a matriz com CSVs de versões, dispositivos e idiomas distintos, especialmente cabeçalhos com identificação de dispositivo e logs próximos aos limites de tamanho.
- Testar eventos exportados de uma falha real e inspecionar documentos PDF visualmente em leitores diferentes.

Nenhuma dessas pendências é apresentada como concluída pelo simples fato de haver código ou configuração correspondente.
