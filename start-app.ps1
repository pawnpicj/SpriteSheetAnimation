$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$appUrl = 'http://127.0.0.1:5186/'
Set-Location -LiteralPath $appRoot
function Test-AppReady {
    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 1
        return $response.StatusCode -eq 200 -and $response.Content.Contains('<title>Sprite Sheet Animation</title>')
    } catch { return $false }
}
if (-not (Test-AppReady)) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $null = New-Item -ItemType Directory -Path (Join-Path $appRoot 'qa') -Force
    $appProcess = Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5186','--strictPort') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $appRoot 'qa/server.log') -RedirectStandardError (Join-Path $appRoot 'qa/server-error.log') -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-AppReady) { $ready = $true; break }
        if ($appProcess.HasExited) { break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Could not start Sprite Sheet Animation. Check qa/server-error.log or whether port 5186 is in use.' }
}
Start-Process $appUrl
