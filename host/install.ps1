# Installs the OmaPen host on Windows with one command, no checkout needed.
# Paste into PowerShell:
#
#   irm https://raw.githubusercontent.com/vladimirstempel/omapen-extension/main/host/install.ps1 | iex
#
# To allow one more extension id, set $env:OMAPEN_EXTENSION_ID before the command.

$ErrorActionPreference = 'Stop'
$repo = 'vladimirstempel/omapen-extension'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'OmaPen needs Node.js. Install it from https://nodejs.org, open a new PowerShell window, then run this command again.' -ForegroundColor Red
  return
}

$work = Join-Path ([IO.Path]::GetTempPath()) ('omapen-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $work | Out-Null
try {
  Write-Host 'Downloading the OmaPen host...'
  $zip = Join-Path $work 'host.zip'
  Invoke-WebRequest -UseBasicParsing -Uri "https://codeload.github.com/$repo/zip/refs/heads/main" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $work
  $root = Get-ChildItem -Path $work -Directory | Select-Object -First 1
  node (Join-Path $root.FullName 'host\install.mjs') @args
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
