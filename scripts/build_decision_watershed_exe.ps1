$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$RequiredIndexFiles = @(
  "data\index\chunks.jsonl",
  "data\index\embeddings.npy",
  "data\index\metadata.json"
)

foreach ($Path in $RequiredIndexFiles) {
  if (-not (Test-Path $Path)) {
    throw "Missing $Path. Run python scripts\build_index.py before building the executable."
  }
}

python -m pip show pyinstaller *> $null
if ($LASTEXITCODE -ne 0) {
  python -m pip install pyinstaller
}

python -m PyInstaller `
  --clean `
  --onefile `
  --windowed `
  --name "IMAC-Decision-Watershed" `
  --paths "$ProjectRoot\src" `
  --add-data "$ProjectRoot\static;static" `
  --add-data "$ProjectRoot\data;data" `
  "$ProjectRoot\scripts\desktop_entry.py"

Write-Host "Built dist\IMAC-Decision-Watershed.exe"
