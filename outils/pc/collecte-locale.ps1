# SentiqS : lancer la collecte depuis ce PC (22/11/2026).
#
# A utiliser seulement si GitHub Actions ne tourne plus (panne, quota,
# compte bloqué). Fait exactement ce que fait le job planifié : ouvre la page
# dans un Chromium piloté, collecte les sources, publie le cache d'actus dans
# Firebase avec le compte de service. Les visiteurs voient alors les actus,
# comme après une collecte de GitHub. L'archive des niveaux et les bulletins
# sont écrits dans ce dossier, sur ce PC (ils ne sont publiés que par GitHub).
#
# Prérequis, une seule fois :
#   1. Node.js LTS : https://nodejs.org (bouton « LTS »), installation par défaut ;
#   2. le fichier JSON du compte de service Firebase (celui du secret
#      FIREBASE_SERVICE_ACCOUNT), copié ici sous le nom compte-service.json.
#      Ce fichier est un secret : il ne doit jamais être envoyé ni publié.
$ErrorActionPreference = 'Stop'
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$racine = Resolve-Path (Join-Path $ici '..\..')
Set-Location $racine

function Arret($texte) {
  Write-Host ''
  Write-Host $texte -ForegroundColor Yellow
  Write-Host ''
  Read-Host 'Appuyez sur Entrée pour fermer'
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Arret "Node.js n'est pas installé. Installez la version LTS depuis https://nodejs.org puis relancez."
}
$compte = Join-Path $ici 'compte-service.json'
if (-not (Test-Path $compte)) {
  Arret "Fichier manquant : $compte`nCopiez-y le fichier JSON du compte de service Firebase (projet sentiqs-235ce)."
}

if (-not (Test-Path (Join-Path $racine 'node_modules\playwright'))) {
  Write-Host 'Première fois : installation des outils (quelques minutes)…'
  npm install --no-save --no-audit --no-fund playwright@1 pptxgenjs@3.12.0 docx@8.5.0
  if ($LASTEXITCODE -ne 0) { Arret 'Installation impossible (réseau ?).' }
  npx playwright install chromium
  if ($LASTEXITCODE -ne 0) { Arret 'Installation du navigateur impossible (réseau ?).' }
}

# Page à charger : GitHub Pages d'abord, le miroir Firebase si Pages ne répond pas.
$cible = 'https://ytl1-ops.github.io/SentiqS/SentiqS_Web.html'
try { Invoke-WebRequest -Uri $cible -Method Head -UseBasicParsing -TimeoutSec 15 | Out-Null }
catch { $cible = 'https://sentiqs-235ce.web.app/SentiqS_Web.html'; Write-Host 'GitHub Pages ne répond pas : miroir Firebase.' }

$env:SENTINEL_URL = $cible
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content -Raw -Encoding UTF8 $compte
$env:COLLECTE_ECHEANCE_EPOCH = [string]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 16 * 60)

Write-Host "Collecte en cours depuis ce PC (15 minutes au plus) — cible : $cible"
node scripts/collecte-planifiee.js
$code = $LASTEXITCODE
Remove-Item Env:FIREBASE_SERVICE_ACCOUNT
Write-Host ''
if ($code -eq 0) { Write-Host 'Collecte terminée et publiée.' -ForegroundColor Green }
else { Write-Host "La collecte s'est arrêtée avec une erreur (code $code). Le message ci-dessus dit pourquoi." -ForegroundColor Yellow }
Read-Host 'Appuyez sur Entrée pour fermer'
