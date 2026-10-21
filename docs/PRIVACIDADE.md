# Privacidade e segurança

O PulseTrace analisa dados no computador. Não há login, telemetria, upload, anúncios, serviços pagos, API remota, banco de dados ou mecanismo de atualização automática. Não consulta sensores ao vivo e não precisa do HWiNFO64 aberto para analisar arquivos existentes.

O aplicativo lê somente arquivos que o usuário seleciona/arrasta. Na integração desktop, os diálogos oficiais concedem escopo aos caminhos escolhidos. A capability não concede acesso global ao filesystem, shell ou HTTP. O botão de exportar escreve no caminho escolhido, que pode substituir um arquivo mediante a confirmação do diálogo do sistema. Nunca escolha seu registro original como destino de um relatório.

Sessões, marcadores, eventos, tema e seleção ficam na memória. O fechamento do aplicativo remove esse estado. O WebView2 pode manter arquivos internos de runtime/cache; não armazenamos os registros importados em localStorage, IndexedDB ou arquivos de sessão. Relatórios exportados permanecem onde o usuário os salvou.

CSV é tratado somente como dados. Não há eval, macros, execução de conteúdo de células ou comandos do Windows. React escapa o texto; HTML exportado escapa caracteres e impede scripts por CSP; exportação CSV neutraliza prefixos de fórmula de planilha. O PDF é construído a partir de texto. Nomes de sensores não são inseridos como HTML nos tooltips.

Limites de tamanho, campos, linhas e valores impedem crescimento ilimitado. Dados malformados são recusados ou contabilizados como ausentes/descartados. Não há alteração automática de BIOS, drivers ou configurações de energia.

O processo de desenvolvimento/build baixa dependências. Isso não é parte do processamento de registros no aplicativo empacotado. O instalador é configurado para incluir o instalador offline do WebView2; a versão sem instalador depende de um runtime WebView2 existente. O runtime Microsoft tem seu próprio ciclo de atualização e condições de uso.

Relatórios podem conter nomes de arquivos e dispositivos. Compartilhar é uma ação manual do usuário. Não anexe registros privados a issues públicas sem revisar seu conteúdo.
