# 一键构建并推送更新到 GitHub
# 推送后 GitHub Actions 会自动构建并部署到 Pages

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

Write-Host "=== 寻数之序 · 一键部署 ===" -ForegroundColor Cyan

# 1. 本地构建验证
Write-Host "`n[1/3] 本地构建验证..." -ForegroundColor Yellow
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "构建失败，请检查错误后重试。" -ForegroundColor Red
    exit 1
}
Write-Host "构建成功 ✓" -ForegroundColor Green

# 2. 提交更改
Write-Host "`n[2/3] 提交更改..." -ForegroundColor Yellow
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$msg = Read-Host "输入提交说明（直接回车使用默认: update $timestamp）"
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = "update: $timestamp"
}

git add -A
git commit -m "$msg" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "没有需要提交的更改，或提交失败。" -ForegroundColor DarkYellow
} else {
    Write-Host "已提交: $msg ✓" -ForegroundColor Green
}

# 3. 推送到 GitHub
Write-Host "`n[3/3] 推送到 GitHub..." -ForegroundColor Yellow
git push origin main 2>&1 | ForEach-Object {
    if ($_ -match 'error|fatal|rejected') {
        Write-Host $_ -ForegroundColor Red
    } else {
        Write-Host $_
    }
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n推送失败。若远程有更新，请先执行: git pull origin main" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== 推送成功 ===" -ForegroundColor Green
Write-Host "GitHub Actions 正在自动构建部署..." -ForegroundColor Cyan
Write-Host "进度查看: https://github.com/$(git remote get-url origin | Select-String -Pattern 'github.com/(.+?)/(.+?)(\.git)?$').Matches.Groups[1].Value/$(git remote get-url origin | Select-String -Pattern 'github.com/(.+?)/(.+?)(\.git)?$').Matches.Groups[2].Value/actions" -ForegroundColor DarkGray
Write-Host "`n按任意键退出..." -ForegroundColor DarkGray
[void][System.Console]::ReadKey($true)
