$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $projectRoot 'src-tauri\target\x86_64-pc-windows-msvc\release'
$artifactRoot = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$binaryPath = Join-Path $releaseRoot 'pulsetrace.exe'
if (-not (Test-Path -LiteralPath $binaryPath)) { throw 'Executável não encontrado. Execute npm run desktop:build primeiro.' }
$installers = Get-ChildItem -LiteralPath (Join-Path $releaseRoot 'bundle\nsis') -Filter '*.exe' -File
if ($installers.Count -eq 0) { throw 'Instalador NSIS não encontrado.' }
foreach ($installer in $installers) { Copy-Item -LiteralPath $installer.FullName -Destination $artifactRoot }
$portableRoot = Join-Path $artifactRoot 'PulseTrace-portatil'
New-Item -ItemType Directory -Path $portableRoot -Force | Out-Null
Copy-Item -LiteralPath $binaryPath -Destination $portableRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\PORTATIL.txt') -Destination $portableRoot
Compress-Archive -LiteralPath $portableRoot -DestinationPath (Join-Path $artifactRoot 'PulseTrace-windows-x64-portatil.zip') -Force
$checksums = Get-ChildItem -LiteralPath $artifactRoot -File | Where-Object { $_.Extension -in '.exe', '.zip' } | ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
    '{0}  {1}' -f $hash.Hash.ToLowerInvariant(), $_.Name
}
$checksums | Set-Content -LiteralPath (Join-Path $artifactRoot 'SHA256SUMS.txt') -Encoding ascii
Write-Output "Artefatos preparados em $artifactRoot. Nenhuma release publicada."
