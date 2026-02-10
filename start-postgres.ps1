# start-postgres.ps1 - Demarrage avec PostgreSQL

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "DEMARRAGE ERP-CRM AVEC POSTGRESQL" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

# Verifier si .env existe
if (-not (Test-Path .\.env)) {
    Write-Host "ATTENTION: Fichier .env non trouve!" -ForegroundColor Yellow
    Write-Host "Copie de .env.example vers .env..." -ForegroundColor Cyan
    Copy-Item .\.env.example -Destination .\.env -ErrorAction SilentlyContinue
    Write-Host "Veuillez configurer le fichier .env avant de continuer" -ForegroundColor Yellow
    exit 1
}

# Verifier PostgreSQL
Write-Host "Verification de PostgreSQL..." -ForegroundColor Cyan
try {
    $pgTest = pg_isready -h localhost -p 5432 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: PostgreSQL est en cours d'execution" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: PostgreSQL n'est pas demarre" -ForegroundColor Red
        Write-Host "ASTUCE: Demarrez PostgreSQL manuellement, puis reessayez" -ForegroundColor Yellow
        Write-Host "   Commande: pg_ctl start -D 'C:\Program Files\PostgreSQL\16\data'" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "ERREUR: PostgreSQL n'est pas installe ou accessible" -ForegroundColor Red
    Write-Host "ASTUCE: Installez PostgreSQL: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

# Executer les migrations
Write-Host "Execution des migrations..." -ForegroundColor Cyan
node .\scripts\migrate-postgres.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Echec des migrations" -ForegroundColor Red
    exit 1
}

# Installer les dependances
Write-Host "Installation des dependances..." -ForegroundColor Cyan
cd server
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Echec installation dependances" -ForegroundColor Red
    exit 1
}

# Demarrer le serveur backend
Write-Host "Demarrage du serveur backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
cd ..

Write-Host "Attente du demarrage du backend (5 secondes)..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Demarrer le frontend
Write-Host "Demarrage du frontend..." -ForegroundColor Green
cd client
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SYSTEME PRET !" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Admin: admin@entreprise.com / admin123" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Cyan