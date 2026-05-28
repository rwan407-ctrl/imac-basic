$ErrorActionPreference = "Stop"

$Processes = Get-CimInstance Win32_Process -Filter "name = 'python.exe'" |
  Where-Object {
    $_.CommandLine -like "*scripts\desktop_entry.py*" -or
    $_.CommandLine -like "*scripts\\desktop_entry.py*"
  }

if (-not $Processes) {
  Write-Host "No IMAC Decision Watershed background process was found."
  exit 0
}

foreach ($Process in $Processes) {
  Stop-Process -Id $Process.ProcessId
  Write-Host "Stopped process $($Process.ProcessId)."
}
