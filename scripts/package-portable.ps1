$ErrorActionPreference = 'Stop'
$releaseDirectory = Join-Path $PSScriptRoot '..\release'
$portable = Get-ChildItem -LiteralPath $releaseDirectory -File -Filter '*-Portable-*.exe' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $portable) {
  throw 'electron-builder did not produce a portable executable.'
}

$zipPath = Join-Path $releaseDirectory ($portable.BaseName + '.zip')
Compress-Archive -LiteralPath $portable.FullName -DestinationPath $zipPath -CompressionLevel Optimal -Force
Write-Output "Created $zipPath"
