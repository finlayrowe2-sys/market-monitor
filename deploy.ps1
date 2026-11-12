# Builds the site and publishes it to GitHub Pages (the gh-pages branch).
# Run from the project folder:  .\deploy.ps1
$ErrorActionPreference = 'Stop'
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\nodejs;" + $env:Path

$remote = git remote get-url origin
$name = git config user.name
$email = git config user.email

npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

$tmp = Join-Path $env:TEMP ("market-monitor-deploy-" + [guid]::NewGuid().ToString('N'))
Copy-Item -Recurse dist $tmp
New-Item -ItemType File (Join-Path $tmp '.nojekyll') | Out-Null

Push-Location $tmp
try {
  git init -q -b gh-pages
  git config user.name $name
  git config user.email $email
  git add -A
  git commit -q -m "Deploy site"
  git push -q --force $remote gh-pages
  if ($LASTEXITCODE -ne 0) { throw "Push failed" }
} finally {
  Pop-Location
  Remove-Item -Recurse -Force $tmp
}
"Deployed."
