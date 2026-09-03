$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host "=== GitHub Deploy Desk : build EXE ==="

Get-Process -Name "GitHubDeployDesk" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
$old = Join-Path $PSScriptRoot "dist\GitHubDeployDesk.exe"
if (Test-Path $old) {
  try { Remove-Item -LiteralPath $old -Force } catch {
    throw "Cannot replace dist\GitHubDeployDesk.exe. Close the running app first."
  }
}

$py = $null
foreach ($cmd in @("py", "python", "python3")) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) { $py = $found.Source; break }
}
if (-not $py) {
  throw "Python not found. Install Python 3.11+ and check Add to PATH."
}

Write-Host "Using $py"
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  & $py -3 -m venv .venv
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { & $py -m venv .venv }
}

$vpy = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $vpy -m pip install -U pip
& $vpy -m pip install -r requirements.txt -r requirements-build.txt
& $vpy -m PyInstaller --noconfirm --clean GitHubDeployDesk.spec

$exe = Join-Path $PSScriptRoot "dist\GitHubDeployDesk.exe"
if (Test-Path $exe) {
  Write-Host "OK: $exe"
  Invoke-Item (Join-Path $PSScriptRoot "dist")
} else {
  throw "EXE was not created."
}
