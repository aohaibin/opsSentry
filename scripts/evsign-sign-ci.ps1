# evsign code-signing wrapper for CI (GitHub Actions windows-latest runner).
# ASCII-only on purpose (Windows PowerShell 5.1 reads a BOM-less .ps1 as GBK).
#
# Unlike the local ~/.evsign/evsign-sign.ps1 (reads license.txt/pwd.txt files), this CI
# variant reads credentials from ENVIRONMENT VARIABLES so nothing secret is committed:
#   EVSIGN_CLI      = absolute path to evsign-client.exe (workflow downloads it, exports here)
#   EVSIGN_LICENSE  = evsign license UUID  (from GitHub Secret)
#   EVSIGN_PASSWORD = evsign signing password (from GitHub Secret)
#
# Called by Tauri signCommand for each Windows binary (main exe + any externalBin sidecar +
# NSIS plugin DLLs + installer). Same copy-sign-swap + file-redirected stdio design as the
# local wrapper so it is robust even if the runner's AV briefly holds a freshly-written file.
param([Parameter(Mandatory = $true)][string]$File)

$ErrorActionPreference = 'Stop'

$cli = $env:EVSIGN_CLI
$key = $env:EVSIGN_LICENSE
$signPwd = $env:EVSIGN_PASSWORD
if (-not $cli -or -not (Test-Path -LiteralPath $cli)) { Write-Error "EVSIGN_CLI not set / missing: $cli"; exit 1 }
if ([string]::IsNullOrEmpty($key)) { Write-Error "EVSIGN_LICENSE env not set"; exit 1 }
if ([string]::IsNullOrEmpty($signPwd)) { Write-Error "EVSIGN_PASSWORD env not set"; exit 1 }
if (-not (Test-Path -LiteralPath $File)) { Write-Error "file not found: $File"; exit 1 }

$tag = [guid]::NewGuid().ToString('N')
$work = Join-Path $env:TEMP "evsign_work_$tag.exe"
$soPath = Join-Path $env:TEMP "evsign_out_$tag.txt"
$siPath = Join-Path $env:TEMP "evsign_in_$tag.txt"
Set-Content -LiteralPath $siPath -Value '' -NoNewline -Encoding ascii

try {
  Copy-Item -LiteralPath $File -Destination $work -Force

  $signArgs = @($work, '-key', $key, '-pwd', $signPwd, '-t', 'digicert')
  $p = Start-Process -FilePath $cli -ArgumentList $signArgs -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $soPath -RedirectStandardError "$soPath.err" -RedirectStandardInput $siPath
  $code = $p.ExitCode
  if ($code -ne 0) {
    $err = (Get-Content -LiteralPath $soPath -Raw -EA SilentlyContinue) + (Get-Content -LiteralPath "$soPath.err" -Raw -EA SilentlyContinue)
    Write-Error ("evsign signing failed (exit $code): " + ($err -replace '\s+', ' '))
    exit $code
  }

  $swapped = $false
  for ($i = 1; $i -le 10; $i++) {
    try { Copy-Item -LiteralPath $work -Destination $File -Force; $swapped = $true; break }
    catch { Start-Sleep -Milliseconds 700 }
  }
  if (-not $swapped) { Write-Error "signed OK but could not overwrite original (still locked): $File"; exit 1 }

  $status = (Get-AuthenticodeSignature -LiteralPath $File).Status
  if ($status -ne 'Valid') { Write-Error "post-swap signature not Valid ($status): $File"; exit 1 }
}
finally {
  Remove-Item -LiteralPath $work, $siPath, $soPath, "$soPath.err" -Force -ErrorAction SilentlyContinue
}
exit 0
