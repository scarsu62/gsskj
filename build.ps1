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
    Write-Error "找不到 index.html"
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
Write-Host "成功生成單一整合網頁檔案！" -ForegroundColor Green
Write-Host "輸出路徑：$OutputPath" -ForegroundColor Green
Write-Host "您可以直接複製此檔案的全部內容，並貼入 Google Sites 的『嵌入程式碼』中。" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
