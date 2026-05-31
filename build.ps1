# build.ps1
# Concatenates CSS and JS into a single index_combined.html for Google Sites deployment

$HtmlPath = Join-Path $PSScriptRoot "index.html"
$CssPath = Join-Path $PSScriptRoot "css/app.css"
$ConfigPath = Join-Path $PSScriptRoot "js/config.js"
$GeminiPath = Join-Path $PSScriptRoot "js/gemini-api.js"
$DbPath = Join-Path $PSScriptRoot "js/firebase-db.js"
$AppPath = Join-Path $PSScriptRoot "js/app.js"
$OutputPath = Join-Path $PSScriptRoot "dist/index_combined.html"

if (-not (Test-Path $HtmlPath)) {
    Write-Error "Cannot find index.html"
    exit 1
}

$html = Get-Content -Raw -Encoding utf8 -Path $HtmlPath
$css = Get-Content -Raw -Encoding utf8 -Path $CssPath
$config = Get-Content -Raw -Encoding utf8 -Path $ConfigPath
$gemini = Get-Content -Raw -Encoding utf8 -Path $GeminiPath
$db = Get-Content -Raw -Encoding utf8 -Path $DbPath
$app = Get-Content -Raw -Encoding utf8 -Path $AppPath

# 1. Replace CSS link with inline style tag
$html = $html.Replace('<link rel="stylesheet" href="css/app.css">', "<style>`n$css`n</style>")

# 2. Replace individual JS script tags with inline scripts
$html = $html.Replace('<script src="js/config.js"></script>', "<script>`n$config`n</script>")
$html = $html.Replace('<script src="js/gemini-api.js"></script>', "<script>`n$gemini`n</script>")
$html = $html.Replace('<script src="js/firebase-db.js"></script>', "<script>`n$db`n</script>")
$html = $html.Replace('<script src="js/app.js"></script>', "<script>`n$app`n</script>")

# 3. Create dist directory if it doesn't exist
$DistDir = Split-Path $OutputPath
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
}

# 4. Save to output
$html | Set-Content -Encoding utf8 -Path $OutputPath

Write-Host "=============================================" -ForegroundColor Green
Write-Host "Build Succeeded!" -ForegroundColor Green
Write-Host "Output file: $OutputPath" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 5. Git Commit & Push (Auto Deploy)
Write-Host "Checking Git status..." -ForegroundColor Cyan
if (Get-Command git -ErrorAction SilentlyContinue) {
    $status = git status --porcelain
    if ($status) {
        Write-Host "Changes detected. Committing..." -ForegroundColor Cyan
        git add .
        $commitMsg = "Auto-rebuild and deploy: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))"
        git commit -m $commitMsg
        Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
        git push
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host "Auto-deploy successful! Pages will update in 1-2 minutes." -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Green
    } else {
        Write-Host "No changes detected. Skipping git commit." -ForegroundColor Yellow
    }
} else {
    Write-Warning "Git command not found in PATH. Please deploy manually."
}
