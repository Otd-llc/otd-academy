# Dump PROD (read-only) and restore it into the LOCAL dev database.
#
# ~66 MB of egress per run, versus the ~4.7 GB/month the old prod-connected dev
# loop burned. Re-run whenever local drifts from prod.
#
# Reads PROD via PROD_DIRECT_URL: pg_dump CANNOT run through the PgBouncer pooler.
#
# ASCII ONLY. PowerShell 5.1 reads .ps1 as ANSI unless the file has a BOM, so a
# stray non-ASCII glyph (em-dash, arrow) corrupts parsing with confusing errors.
#
# Run:  pnpm db:pull-prod
$ErrorActionPreference = "Stop"

# --- locate pg_dump / pg_restore / psql --------------------------------------
# Do NOT rely on PATH: a process started before the installer ran (or a fresh
# clone on another machine) will not have it. Prefer PATH, then probe the
# standard Windows install locations, newest major version first.
function Find-PgTool([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending
    foreach ($c in $candidates) {
        $exe = Join-Path $c.FullName "bin\$name.exe"
        if (Test-Path $exe) { return $exe }
    }
    throw "$name not found. Install PostgreSQL 17 (winget install PostgreSQL.PostgreSQL.17) or add its bin/ to PATH."
}
$PgDump    = Find-PgTool "pg_dump"
$PgRestore = Find-PgTool "pg_restore"
$Psql      = Find-PgTool "psql"

# --- read the two URLs out of .env.local -------------------------------------
$envFile = Join-Path $PSScriptRoot "..\.env.local"
if (-not (Test-Path $envFile)) { throw ".env.local not found at $envFile" }

$vars = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
        $vars[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}

$prod  = $vars['PROD_DIRECT_URL']
$local = $vars['DATABASE_URL']
if (-not $prod)  { throw "PROD_DIRECT_URL not set in .env.local" }
if (-not $local) { throw "DATABASE_URL not set in .env.local" }

# --- refuse to overwrite anything that is not local --------------------------
# This script DROPS AND RECREATES every object in its target. If DATABASE_URL
# were still pointed at Neon, that would destroy production.
$localUri  = [Uri]$local
$prodUri   = [Uri]$prod
$localHost = $localUri.Host
$prodHost  = $prodUri.Host
$localOk   = @('localhost', '127.0.0.1', '::1')

if ($localOk -notcontains $localHost) {
    throw "REFUSING: DATABASE_URL host is '$localHost', not local. This script overwrites its target."
}
if ($localOk -contains $prodHost) {
    throw "REFUSING: PROD_DIRECT_URL host is '$prodHost', which is not prod."
}

$dbName   = $localUri.AbsolutePath.TrimStart('/')
$dbUser   = $localUri.UserInfo.Split(':')[0]
$dbPass   = $localUri.UserInfo.Split(':')[1]

Write-Host "  source (read-only) : $prodHost"
Write-Host "  target (OVERWRITE) : $localHost/$dbName"
Write-Host ""

$dump = Join-Path $env:TEMP "foundry-prod-$(Get-Date -Format yyyyMMdd-HHmmss).dump"

try {
    Write-Host "  dumping prod ..."
    # custom format; --no-owner/--no-privileges so it restores under the local
    # superuser without Neon's roles (neondb_owner, neon_superuser) existing here.
    & $PgDump --format=custom --no-owner --no-privileges --file=$dump $prod
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE)" }
    $mb = "{0:N1}" -f ((Get-Item $dump).Length / 1MB)
    Write-Host "  dumped: $mb MB"

    Write-Host "  restoring into local ..."
    # pg_restore exits non-zero on benign notices (DROP ... IF EXISTS against a
    # fresh database, extension comments it does not own). Capture and judge the
    # output rather than trusting the exit code alone.
    $out = & $PgRestore --clean --if-exists --no-owner --no-privileges --dbname=$local $dump 2>&1
    $restoreExit = $LASTEXITCODE
    $errLines = @($out | Where-Object { "$_" -match 'error:' })
    if ($errLines.Count -gt 0) {
        Write-Host ""
        Write-Warning "pg_restore reported $($errLines.Count) error line(s):"
        $errLines | Select-Object -First 15 | ForEach-Object { Write-Host "    $_" }
        if ($errLines.Count -gt 15) { Write-Host "    ... $($errLines.Count - 15) more" }
        Write-Host ""
    }
    elseif ($restoreExit -ne 0) {
        Write-Host "  pg_restore exit $restoreExit with no error lines (benign notices)"
    }
}
finally {
    if (Test-Path $dump) { Remove-Item $dump -Force; Write-Host "  cleaned up dump file" }
}

Write-Host ""
Write-Host "  verifying row counts ..."
$env:PGPASSWORD = $dbPass
# Pass the SQL via a FILE, not -c. PowerShell mangles the doubled double-quotes
# that Postgres needs around camelCase identifiers when handing args to a native
# exe, so `"MiniLesson"` arrives unquoted, Postgres lowercases it, and the query
# fails with a misleading 'relation "minilesson" does not exist'.
$sqlFile = Join-Path $env:TEMP "foundry-verify-$(Get-Date -Format yyyyMMddHHmmss).sql"
@'
SELECT 'MiniLesson (published PUBLIC)' AS t, count(*)::text AS n FROM "MiniLesson" WHERE published AND "accessTier"='PUBLIC'
UNION ALL SELECT 'Project',        count(*)::text FROM "Project"
UNION ALL SELECT 'Part',           count(*)::text FROM "Part"
UNION ALL SELECT 'KicadLibSymbol', count(*)::text FROM "KicadLibSymbol"
UNION ALL SELECT 'User',           count(*)::text FROM "User";
'@ | Set-Content $sqlFile -Encoding ascii
try {
    $counts = & $Psql -U $dbUser -h $localHost -d $dbName -t -A -F' | ' -f $sqlFile
    foreach ($c in $counts) { if ("$c".Trim()) { Write-Host "    $c" } }
} finally {
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
}
Write-Host ""
Write-Host "  expected (prod @ 2026-07-15): MiniLesson 69 | Project 24 | Part 53 | KicadLibSymbol 22730"
Write-Host "  done."
