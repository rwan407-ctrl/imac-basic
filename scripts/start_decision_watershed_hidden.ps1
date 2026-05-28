$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot

Start-Process `
  -FilePath python `
  -ArgumentList @("scripts\desktop_entry.py") `
  -WorkingDirectory $ProjectRoot `
  -WindowStyle Hidden

Write-Host "IMAC Decision Watershed started in the background."
Write-Host "Open http://127.0.0.1:8765 when you want to use it."
