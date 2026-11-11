param([ValidateRange(1, 65535)][int]$Port = 8000)

$ErrorActionPreference = 'Stop'
$demoRoot = $PSScriptRoot
$demoProcess = $null

function Get-DemoHealth([string]$Address) {
    try {
        $health = Invoke-RestMethod -Uri "$Address/api/health" -TimeoutSec 1
        return ($health.app -eq 'react-loop-lab-demo' -and $health.repo -eq (Split-Path $demoRoot -Leaf))
    } catch { return $false }
}

try {
    $serverPath = Join-Path $demoRoot 'demo_ui\server.py'
    if (-not (Test-Path -LiteralPath $serverPath)) { throw 'Cannot find demo_ui/server.py.' }
    $pythonPath = Join-Path $demoRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
        if (-not $pythonCommand) { throw 'Python was not found. Install Python 3.10+ or use the project .venv.' }
        $pythonPath = $pythonCommand.Source
    }

    $demoUrl = $null
    $lastPort = [Math]::Min(65535, $Port + 10)
    for ($candidatePort = $Port; $candidatePort -le $lastPort; $candidatePort++) {
        $candidateUrl = "http://127.0.0.1:$candidatePort"
        if (Get-DemoHealth $candidateUrl) {
            $demoUrl = $candidateUrl
            break
        }
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
        try { $listener.Start() } catch { continue } finally { $listener.Stop() }

        $logDirectory = Join-Path $demoRoot 'demo_ui\logs'
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        $stdoutPath = Join-Path $logDirectory "server-$candidatePort.out.log"
        $stderrPath = Join-Path $logDirectory "server-$candidatePort.err.log"
        $demoArguments = @(('"{0}"' -f $serverPath), '--port', "$candidatePort")
        $demoProcess = Start-Process -FilePath $pythonPath -ArgumentList $demoArguments `
            -WorkingDirectory $demoRoot -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if (Get-DemoHealth $candidateUrl) { $demoUrl = $candidateUrl; break }
            if ($demoProcess.HasExited) { break }
            Start-Sleep -Milliseconds 200
        }
        if ($demoUrl) {
            $demoProcess.Id | Set-Content -LiteralPath (Join-Path $logDirectory 'server.pid')
            break
        }
        if (-not $demoProcess.HasExited) { $demoProcess.Kill() }
        throw "Demo did not start. Check $stderrPath"
    }
    if (-not $demoUrl) { throw 'No available local port was found. Try -Port 8100.' }
    Start-Process "$demoUrl/?present=1#H6"
    Write-Host "Demo is ready: $demoUrl" -ForegroundColor Green
    Write-Host 'This viewer reads saved eval JSON only; it does not call the model.'
    Write-Host 'The local server stays running when this launcher closes.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    try {
        $popup = New-Object -ComObject WScript.Shell
        $null = $popup.Popup($_.Exception.Message, 0, 'ReAct Lab Demo', 16)
    } catch { Write-Host 'See demo_ui/logs for details.' }
    exit 1
}
