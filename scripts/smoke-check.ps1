#requires -Version 5.1
<#
.SYNOPSIS
    Boots the PHILS LEARNOVA app on an ephemeral port and probes the critical endpoints.

.DESCRIPTION
    Self-contained smoke check. It starts `server/src/app.js`, waits for /api/health,
    verifies the public + guarded routes, prints PASS/FAIL per check, then stops the
    server (unless -KeepRunning). Exit code is 0 when every check passes, otherwise 1.

.PARAMETER Port
    Port to boot the test server on. Default 3016 (kept clear of dev ports 3000/3013/3014).

.PARAMETER KeepRunning
    Leave the server running after the checks (useful for manual browser verification).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\smoke-check.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\smoke-check.ps1 -Port 3017 -KeepRunning
#>
[CmdletBinding()]
param(
    [int]$Port = 3016,
    [switch]$KeepRunning
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
if (-not (Test-Path (Join-Path $root 'server\src\app.js'))) {
    Write-Host "FAIL cannot locate server/src/app.js (looked under $root)" -ForegroundColor Red
    exit 1
}

$baseUrl = "http://127.0.0.1:$Port"
$stdoutLog = Join-Path $env:TEMP "learnova-smoke-$PID.out.log"
$stderrLog = Join-Path $env:TEMP "learnova-smoke-$PID.err.log"

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
    param([string]$Name, [bool]$Pass, [string]$Detail = '')
    $script:results.Add([pscustomobject]@{ Name = $Name; Pass = $Pass; Detail = $Detail })
    $tag = if ($Pass) { 'PASS' } else { 'FAIL' }
    $color = if ($Pass) { 'Green' } else { 'Red' }
    $suffix = if ($Detail) { " :: $Detail" } else { '' }
    Write-Host ("{0} {1}{2}" -f $tag, $Name, $suffix) -ForegroundColor $color
}

function Invoke-Probe {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{}
    )
    try {
        $resp = Invoke-WebRequest -Uri "$baseUrl$Path" -Method $Method -Headers $Headers -UseBasicParsing -TimeoutSec 8
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Content = $resp.Content }
    } catch {
        $status = 0
        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = 0 }
        }
        return [pscustomobject]@{ Status = $status; Content = $_.ErrorDetails.Message }
    }
}

Write-Host "PHILS LEARNOVA smoke check -> $baseUrl" -ForegroundColor Cyan

$proc = $null
try {
    $env:PORT = "$Port"
    $proc = Start-Process -FilePath 'node' -ArgumentList 'server/src/app.js' `
        -WorkingDirectory $root -PassThru `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog

    $ready = $false
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ($proc.HasExited) { break }
        $probe = Invoke-Probe -Method 'GET' -Path '/api/health'
        if ($probe.Status -eq 200) { $ready = $true; break }
        Start-Sleep -Milliseconds 400
    }

    if (-not $ready) {
        Add-Result 'server boots and answers /api/health' $false 'no response within 20s'
    } else {
        Add-Result 'server boots and answers /api/health' $true "port $Port"

        $health = Invoke-Probe -Method 'GET' -Path '/api/health'
        $healthBody = $null
        try { $healthBody = $health.Content | ConvertFrom-Json } catch { $healthBody = $null }
        Add-Result 'GET /api/health -> 200' ($health.Status -eq 200) "status=$($health.Status)"
        Add-Result 'health body reports status=ok' ($null -ne $healthBody -and $healthBody.status -eq 'ok') "status=$($healthBody.status)"

        $csrf = Invoke-Probe -Method 'GET' -Path '/api/csrf-token'
        $csrfBody = $null
        try { $csrfBody = $csrf.Content | ConvertFrom-Json } catch { $csrfBody = $null }
        Add-Result 'GET /api/csrf-token -> 200 with token' ($csrf.Status -eq 200 -and $null -ne $csrfBody -and -not [string]::IsNullOrWhiteSpace($csrfBody.csrfToken)) "status=$($csrf.Status)"

        $admin = Invoke-Probe -Method 'GET' -Path '/api/admin/dashboard'
        Add-Result 'GET /api/admin/dashboard without cookie -> 401' ($admin.Status -eq 401) "status=$($admin.Status)"

        $student = Invoke-Probe -Method 'GET' -Path '/api/student/dashboard'
        Add-Result 'GET /api/student/dashboard without cookie -> 401' ($student.Status -eq 401) "status=$($student.Status)"

        $missing = Invoke-Probe -Method 'GET' -Path '/api/does-not-exist'
        Add-Result 'unknown route -> 404' ($missing.Status -eq 404) "status=$($missing.Status)"
    }
} finally {
    if ($proc -and -not $KeepRunning -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

$failed = @($results | Where-Object { -not $_.Pass })
if ($failed.Count -gt 0) {
    if (Test-Path $stderrLog) {
        $err = Get-Content $stderrLog -Tail 10 -ErrorAction SilentlyContinue
        if ($err) {
            Write-Host '--- server stderr (tail) ---' -ForegroundColor DarkYellow
            $err | ForEach-Object { Write-Host "  $_" }
        }
    }
    Write-Host ("RESULT: {0} check(s) failed" -f $failed.Count) -ForegroundColor Red
    Remove-Item $stdoutLog, $stderrLog -ErrorAction SilentlyContinue
    exit 1
}

Write-Host 'RESULT: ALL PASS' -ForegroundColor Green
if ($KeepRunning) {
    Write-Host "server left running on $baseUrl (PID $($proc.Id))" -ForegroundColor Cyan
}
Remove-Item $stdoutLog, $stderrLog -ErrorAction SilentlyContinue
exit 0