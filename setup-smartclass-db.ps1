param(
    [string]$Password = ""
)

$possiblePaths = @(
    "C:\xampp\mysql\bin\mysql.exe",
    "C:\Program Files\xampp\mysql\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
    "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe"
)

$mysqlPath = $null
foreach ($p in $possiblePaths) {
    if (Test-Path $p) {
        $mysqlPath = $p
        break
    }
}

if (-not $mysqlPath) {
    Write-Error "MySQL client not found. Please install XAMPP or MySQL first, then run this script again."
    exit 1
}

$rootFlag = if ($Password) { "--password=$Password" } else { "--password=" }

Write-Host "Using MySQL client: $mysqlPath"
Write-Host "Creating database smartclass..."
& $mysqlPath --user=root $rootFlag -e "CREATE DATABASE IF NOT EXISTS smartclass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

Write-Host "Importing schema..."
& $mysqlPath --user=root $rootFlag smartclass < "$PSScriptRoot\database\schema.sql"

Write-Host "Importing seed data..."
& $mysqlPath --user=root $rootFlag smartclass < "$PSScriptRoot\database\seeders\001_development_seed.sql"

Write-Host "Database setup complete. Smartclass is ready."
