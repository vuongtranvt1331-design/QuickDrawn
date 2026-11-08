$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Run-Git { & git @args; if ($LASTEXITCODE -ne 0) { throw "Git that bai: git $($args -join ' ')" } }
try {
  Write-Host 'Cap nhat QuickDrawn len GitHub' -ForegroundColor Cyan
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Chua cai Git. Cai Git for Windows roi chay lai.' }
  if (-not (Test-Path -LiteralPath '.git')) { throw 'Thu muc chua duoc lien ket voi kho Git. Hay lien he de duoc cau hinh lai.' }
  $branch = (& git branch --show-current).Trim()
  if ($branch -ne 'main') { throw "Dang o nhanh '$branch', khong phai main. Khong tu dong day." }
  $remote = (& git remote get-url origin).Trim()
  if ($remote -notmatch '^https://github\.com/vuongtranvt1331-design/QuickDrawn(?:\.git)?/?$') { throw 'Dia chi origin khong khop kho QuickDrawn da chon. Khong tu dong day.' }
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    & gh auth status -h github.com 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host 'Can dang nhap GitHub lan dau. Hay hoan tat trong trinh duyet.' -ForegroundColor Yellow
      & gh auth login -h github.com --git-protocol https --web
      if ($LASTEXITCODE -ne 0) { throw 'Dang nhap GitHub chua thanh cong.' }
    }
    & gh auth setup-git -h github.com
    if ($LASTEXITCODE -ne 0) { throw 'Khong cau hinh duoc dang nhap Git.' }
  }
  Run-Git fetch origin main
  & git merge-base --is-ancestor origin/main HEAD
  if ($LASTEXITCODE -ne 0) { throw 'GitHub co thay doi chua duoc dong bo. Da dung de tranh ghi de; can hop nhat truoc khi cap nhat.' }
  $gitName = [string](& git config user.name); $gitName = $gitName.Trim(); $gitEmail = [string](& git config user.email); $gitEmail = $gitEmail.Trim()
  if (-not $gitName) { Run-Git config --local user.name 'vuongtranvt1331-design' }
  if (-not $gitEmail) { Run-Git config --local user.email '344732410+vuongtranvt1331-design@users.noreply.github.com' }
  Run-Git add -A
  & git diff --cached --quiet
  if ($LASTEXITCODE -eq 1) { Run-Git commit -m ('Update game ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')) }
  elseif ($LASTEXITCODE -ne 0) { throw 'Khong the kiem tra thay doi.' }
  Run-Git push origin HEAD:main
  Write-Host 'Da cap nhat GitHub thanh cong.' -ForegroundColor Green
} catch {
  Write-Host "Khong cap nhat duoc: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
