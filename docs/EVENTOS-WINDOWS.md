# Eventos locais do Windows

A importação de eventos é opcional. O PulseTrace não executa PowerShell, não coleta automaticamente logs e não solicita elevação. A análise de CSV funciona sem eventos.

Abra **Investigar desligamento → Importar eventos JSON**. O JSON deve conter um objeto ou uma lista de objetos com:

```json
[
  {
    "TimeCreated": "2026-10-20T20:15:00-03:00",
    "Id": 41,
    "ProviderName": "Microsoft-Windows-Kernel-Power",
    "Message": "Mensagem registrada pelo Windows."
  }
]
```

O exemplo é sintético. O fuso é obrigatório. Datas locais ambíguas são recusadas. O limite é 5 MiB e 10.000 eventos. Não importe arquivos EVTX diretamente: a versão inicial aceita JSON.

## Exportação opcional para usuários avançados

O usuário comum pode usar toda a investigação somente com CSV. Para incluir eventos, alguém familiarizado com PowerShell pode executar o exemplo abaixo. Ele apenas consulta o log System e escreve um novo JSON na pasta Documentos, sem mudar o log ou configurações do Windows:

```powershell
$eventStart = (Get-Date).AddDays(-2)
$eventPath = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('PulseTrace-eventos-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
Get-WinEvent -FilterHashtable @{ LogName = 'System'; StartTime = $eventStart; Id = 41,6008,1001,17,18,19 } -MaxEvents 2000 |
  Select-Object @{Name='TimeCreated';Expression={$_.TimeCreated.ToUniversalTime().ToString('o')}}, Id, ProviderName, Message |
  ConvertTo-Json -Depth 3 |
  Set-Content -LiteralPath $eventPath -Encoding UTF8
Write-Output $eventPath
```

Os IDs não são globalmente exclusivos: confira sempre o provedor. A visibilidade do log depende das políticas locais da conta; se o acesso for negado, a importação permanece opcional. Não é necessário conceder permissões administrativas ao PulseTrace.

Antes de comparar, confira o fuso do CSV, o fuso explícito do JSON e possíveis diferenças entre relógios. A correção de relógio na tela é somada aos eventos e não altera o arquivo original. Mensagens podem conter nomes de dispositivos/computadores; revise antes de compartilhar. Eventos e marcadores não são incluídos nos relatórios gerais desta versão.
