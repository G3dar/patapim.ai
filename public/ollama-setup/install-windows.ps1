# PATAPIM — Ollama server installer (Windows)
# Usage (elevated PowerShell):
#   iwr -useb https://patapim.ai/ollama-setup/install-windows.ps1 | iex
#
# What it does:
#   1. Installs Ollama (if missing) via the official installer
#   2. Pulls the default model (qwen2.5:7b)
#   3. Optionally binds Ollama to 0.0.0.0:11434 so other LAN devices can reach it
#   4. Opens Windows Firewall port 11434 (inbound, TCP, private network only)
#
# All steps are idempotent — safe to re-run.

$ErrorActionPreference = 'Stop'
$DefaultModel = 'qwen2.5:7b'
$Port = 11434

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    $msg" -ForegroundColor Red }

# ── 1. Install Ollama if missing ─────────────────────────────────────────
$ollamaExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (Test-Path $ollamaExe) {
  Write-Step "Ollama already installed at $ollamaExe"
} else {
  Write-Step "Downloading and installing Ollama..."
  $installerUrl = 'https://ollama.com/download/OllamaSetup.exe'
  $installerPath = Join-Path $env:TEMP 'OllamaSetup.exe'
  Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
  Start-Process -FilePath $installerPath -ArgumentList '/SILENT' -Wait
  Remove-Item $installerPath -ErrorAction SilentlyContinue
  if (-not (Test-Path $ollamaExe)) {
    Write-Err "Installation finished but ollama.exe not found at expected path."
    exit 1
  }
  Write-Ok "Ollama installed."
}

# ── 2. Ask about LAN binding ─────────────────────────────────────────────
Write-Step "LAN access"
Write-Host "    By default Ollama only accepts connections from localhost."
Write-Host "    If you want other devices on your network (phone, laptop, etc.)"
Write-Host "    to reach this server, bind it to 0.0.0.0."
$lanChoice = Read-Host "    Enable LAN access? [y/N]"
$bindLan = $lanChoice -match '^[Yy]'

if ($bindLan) {
  [Environment]::SetEnvironmentVariable('OLLAMA_HOST', "0.0.0.0:$Port", 'User')
  Write-Ok "Set OLLAMA_HOST=0.0.0.0:$Port (user env var). Restart Ollama to apply."

  Write-Step "Opening Windows Firewall (inbound TCP $Port, private profile)"
  try {
    $ruleName = "Ollama server (port $Port)"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Ok "Firewall rule already exists."
    } else {
      New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port `
        -Profile Private `
        -Program $ollamaExe `
        | Out-Null
      Write-Ok "Firewall rule created."
    }
  } catch {
    Write-Warn "Could not create firewall rule (need elevated PowerShell?): $_"
  }
} else {
  Write-Ok "Keeping default (localhost only). You can still access via patapim.ai's tunnel."
}

# ── 3. Start Ollama (tray app) ───────────────────────────────────────────
Write-Step "Starting Ollama"
$ollamaAppExe = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
if (Get-Process -Name 'ollama' -ErrorAction SilentlyContinue) {
  Write-Ok "Ollama already running. Restart it to pick up env changes if you enabled LAN."
} else {
  Start-Process -FilePath $ollamaAppExe -WindowStyle Hidden
  Write-Ok "Launched."
}

Start-Sleep -Seconds 3

# ── 4. Pull default model ────────────────────────────────────────────────
Write-Step "Pulling default model: $DefaultModel (this can take a few minutes)"
& $ollamaExe pull $DefaultModel
if ($LASTEXITCODE -eq 0) {
  Write-Ok "Model ready."
} else {
  Write-Err "Model pull failed. Run manually later: ollama pull $DefaultModel"
}

# ── 5. Show next steps ───────────────────────────────────────────────────
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.*' } |
            Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Ollama setup complete." -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host " Local URL:     http://localhost:$Port"
if ($bindLan -and $localIp) {
  Write-Host " LAN URL:       http://$localIp`:$Port"
}
Write-Host ""
Write-Host " Next: open https://patapim.ai/admin -> Ollama Server tab"
Write-Host "       and save this server's address so every PATAPIM device"
Write-Host "       linked to your account can find it."
Write-Host ""
