$ErrorActionPreference = 'Stop'

function Get-Sha256Hex {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LiteralPath
  )

  $stream = [System.IO.File]::OpenRead($LiteralPath)
  try {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
      $bytes = $algorithm.ComputeHash($stream)
      return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
      $algorithm.Dispose()
    }
  }
  finally {
    $stream.Dispose()
  }
}

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

$checksums = Get-ChildItem -LiteralPath $releaseDirectory -File |
  Where-Object { $_.Extension -in @('.exe', '.zip') } |
  Sort-Object Name |
  ForEach-Object { "{0}  {1}" -f (Get-Sha256Hex -LiteralPath $_.FullName), $_.Name }
$checksumPath = Join-Path $releaseDirectory 'SHA256SUMS.txt'
Set-Content -LiteralPath $checksumPath -Value $checksums -Encoding utf8
Write-Output "Created $checksumPath"
