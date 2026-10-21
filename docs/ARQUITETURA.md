# Arquitetura e plano de implementação

O PulseTrace é um aplicativo desktop Tauri 2. React e TypeScript compõem a interface; Rust hospeda a janela e os plugins oficiais de diálogos e filesystem. O motor determinístico é TypeScript puro, compartilhado entre testes e aplicação. Não há servidor de aplicação em produção.

## Plano executado

1. Inspecionar workspace e ferramentas: diretório inicialmente vazio; Node.js disponível, Rust/MSVC ausentes no PATH.
2. Estruturar importação, normalização, modelo tipado e regras isoladas.
3. Criar interface em português, temas, gráficos, linha do tempo e investigação.
4. Integrar diálogos desktop e leitura limitada, exportação e comparação.
5. Testar núcleo, entradas malformadas, fluxos de navegador e um arquivo público externo.
6. Preparar Tauri/NSIS, pipeline, checksums, instruções e evidências.

A validação de execução desktop e instalação Windows é uma etapa separada do build frontend. Consulte [VALIDACAO.md](VALIDACAO.md) para o estado real, sem tratar configuração como prova de funcionamento.

## Organização

```text
src/
  core/          Tipos, limites e formatação
  import/        Tokenizador incremental, codificação, datas, aliases, worker
  analysis/      Regras, estatísticas, comparação, investigação e eventos
  export/        HTML, PDF e CSV
  platform/      Diálogos e filesystem nativo; downloads no preview
  hooks/         Coordenação da fila e cancelamento
  components/    Gráficos, seletor de intervalo, observações
  pages/         Telas funcionais
src-tauri/       Host Rust, permissões e instalador
tests/unit/     Testes do núcleo e validação externa opcional
tests/e2e/      Fluxos Playwright em Chromium
docs/           Regras, privacidade, distribuição, evidências
scripts/        Empacotamento e identidade visual
.github/        Automação de testes e artefatos, sem publicação
```

## Fluxo de dados

Arquivo selecionado → validação de tamanho → worker → detecção de codificação/delimitador → tokenizador → timestamps e sensores normalizados → arrays tipados → sessão em memória → regras/estatísticas → interface ou relatório.

O tokenizador recebe blocos de 256 KiB. Estado de aspas atravessa blocos. O worker é encerrado no cancelamento, liberando suas estruturas. No desktop, a leitura do arquivo usa blocos de 256 KiB e verifica cancelamento entre leituras; a pasta selecionada é enumerada somente no primeiro nível. No navegador, o seletor de pasta pode incluir subpastas, de acordo com a implementação do navegador.

Timestamp usa Float64 (milissegundos desde epoch). Valores usam Float32; NaN representa ausência. Os números são arredondados à precisão de Float32, não são preservados como strings decimais exatas. Importação fora de ordem aplica ordenação estável à sessão inteira; timestamps repetidos são preservados e sinalizados. Não há interpolação.

Os gráficos reduzem pontos para visualização por blocos preservando extremos, primeira/última leitura e ausências. Relatórios e regras usam todas as leituras aceitas. O zoom e os campos de data compartilham um intervalo absoluto; o tooltip usa texto, nunca HTML fornecido pelo arquivo.

## Limites e desempenho

| Recurso | Limite |
|---|---:|
| Arquivo CSV | 64 MiB |
| Colunas por linha | 4.096 |
| Linhas de dados | 1.000.000 |
| Valores por sessão | 6.000.000 |
| Sessões simultâneas | 3 |
| Valores totais em sessões aceitas | 12.000.000 |
| Campo textual | 16.384 caracteres |
| Linha lógica | 1.048.576 caracteres |
| Eventos JSON | 5 MiB / 10.000 entradas |

Esses são limites estruturais, não uma garantia de teto exato de RAM. Há overhead de Blob, decodificação, arrays intermediários, ordenação, renderização e exportação. Uma sessão em importação pode existir antes da verificação do orçamento total. Arquivos com muitos pontos ausentes podem exigir mais pontos no gráfico para preservar as lacunas. A análise e a exportação são locais; relatórios grandes podem ocupar a thread da interface. Não há suporte a logs ilimitados ou acompanhamento em tempo real nesta versão.

## Identidade e normalização

Não há posição fixa de sensor. A identificação usa o nome do cabeçalho. ID local contém a coluna original; identidade de comparação contém grupo, nome original e ocorrência. Grupos explícitos entre colchetes são preservados, assim como identificadores explícitos de dispositivo em nomes. Qualificadores como `(avg)` não são dispositivos.

Cabeçalhos sem dispositivo continuam sem dispositivo: não se inventa uma associação física. CPU/GPU/Memória/Armazenamento são categorias heurísticas por aliases em português/inglês, não identificação completa do hardware. Sensores não reconhecidos ficam em Sistema. Os aliases não constituem suporte universal a todas as traduções ou modos de exportação.

UTF-8, UTF-16 LE/BE e Windows-1252 são detectados por BOM/heurística. Delimitadores aceitos: vírgula, ponto e vírgula e tabulação. UTF-8 versus Windows-1252 usa a primeira amostra de 64 KiB; codificação mista não é suportada. Unidades explícitas °F/K, GHz/kHz/Hz, mW/kW são convertidas para °C/MHz/W. Unidades ausentes não são presumidas. Flags Yes/No e Sim/Não viram estados 1/0.

## Extensibilidade

Novos aliases pertencem a `import/normalize.ts`; novos formatos de data a `import/timestamp.ts`; novas regras a `analysis/rules.ts`, com teste que também demonstre casos negativos. `RuleConfig` permite parametrizar limites no núcleo; nesta versão a interface usa os valores padrão documentados. Limites por modelo não estão disponíveis.

As sessões não são persistidas. Tema, seleção, eventos importados e marcadores são transitórios. Não há conta, banco, telemetria, integração direta com sensores, comandos de shell ou atualização automática.
