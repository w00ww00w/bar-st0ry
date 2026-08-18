$ErrorActionPreference = "Stop"

$version = "0.10.6"
$archiveName = "codebase-memory-mcp-ui-windows-amd64.zip"
$installDir = Join-Path $PSScriptRoot "..\.cache\cbm"
$binary = Join-Path $installDir "codebase-memory-mcp.exe"

if (-not (Test-Path -LiteralPath $binary)) {
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    $baseUrl = "https://github.com/DeusData/codebase-memory-mcp/releases/download/v$version"
    $archive = Join-Path $installDir $archiveName
    $checksums = Join-Path $installDir "checksums.txt"

    Write-Host "Downloading code graph v$version..."
    Invoke-WebRequest "$baseUrl/$archiveName" -OutFile $archive
    Invoke-WebRequest "$baseUrl/checksums.txt" -OutFile $checksums

    $line = Get-Content $checksums | Where-Object { $_ -match [regex]::Escape($archiveName) } | Select-Object -First 1
    if (-not $line) { throw "Checksum for $archiveName was not found" }
    $expected = ($line -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Downloaded archive checksum does not match" }

    Expand-Archive -LiteralPath $archive -DestinationPath $installDir -Force
    Remove-Item -LiteralPath $archive, $checksums -Force
}

Write-Host "Code graph: http://localhost:9749"
& $binary --ui=true --port=9749
