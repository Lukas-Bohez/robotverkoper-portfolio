<#
.SYNOPSIS
  Builds "Delivery Robot Demo.exe" (the one-click demo launcher) and puts a shortcut on the desktop.

.DESCRIPTION
  Uses the C# compiler that ships with Windows, so there is nothing to install.
  The exe is not committed (*.exe): every machine builds its own with this script.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File Lukas\demo-launcher\build.ps1
  powershell -ExecutionPolicy Bypass -File Lukas\demo-launcher\build.ps1 -NoShortcut
#>
param(
  [string] $Out = (Join-Path $PSScriptRoot 'Delivery Robot Demo.exe'),
  [switch] $NoShortcut
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "csc.exe not found: $csc (.NET Framework 4 is part of Windows)" }

# The icon: a green rounded square with a small robot face, generated once
if (-not (Test-Path 'icon.ico')) {
  Add-Type -AssemblyName System.Drawing
  $bmp = New-Object System.Drawing.Bitmap 64, 64
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 14
  $path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc(64 - $r, 0, $r, $r, 270, 90)
  $path.AddArc(64 - $r, 64 - $r, $r, $r, 0, 90); $path.AddArc(0, 64 - $r, $r, $r, 90, 90)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 163, 74))), $path)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillRectangle($white, 14, 22, 36, 26)       # head
  $g.FillRectangle($white, 30, 12, 4, 10)        # antenna
  $g.FillEllipse($white, 27, 8, 10, 8)
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 163, 74))
  $g.FillEllipse($dark, 20, 29, 8, 8); $g.FillEllipse($dark, 36, 29, 8, 8)
  $g.FillRectangle($dark, 22, 41, 20, 3)
  $g.Dispose()
  $stream = [System.IO.File]::Create((Join-Path $PSScriptRoot 'icon.ico'))
  [System.Drawing.Icon]::FromHandle($bmp.GetHicon()).Save($stream)
  $stream.Close()
}

& $csc /nologo /target:winexe /optimize /out:$Out /win32icon:icon.ico `
  /r:System.Windows.Forms.dll /r:System.Drawing.dll DemoLauncher.cs
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
Write-Host "Built $Out"

if (-not $NoShortcut) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut((Join-Path $desktop 'Delivery Robot Demo.lnk'))
  $link.TargetPath = $Out
  $link.WorkingDirectory = Split-Path $Out
  $link.IconLocation = "$Out,0"
  $link.Description = 'Start the demo of Lukas: platform simulator, seller API with its own database, seller PWA and the robot simulator'
  $link.Save()
  Write-Host "Shortcut on the desktop: Delivery Robot Demo"
}
