# Genera los PNG del logo GeoVista (ojo-globo) desde System.Drawing.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/gen-logo.ps1
# Nota: New-Object Tipo(...) falla con expresiones anidadas con comas;
# por eso todo va en variables simples antes de construir.
Add-Type -AssemblyName System.Drawing

function New-GeoVistaLogo {
    param([int]$Size, [string]$Path)

    $u = [double]$Size / 128.0
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $navy = [System.Drawing.Color]::FromArgb(255, 4, 7, 15)
    $g.Clear($navy)

    $cx = 64.0 * $u
    $cy = 64.0 * $u

    # Órbita inclinada.
    $orbitColor = [System.Drawing.Color]::FromArgb(115, 56, 189, 248)
    $orbitWidth = 3.0 * $u
    $orbit = New-Object System.Drawing.Pen($orbitColor, $orbitWidth)
    $g.TranslateTransform($cx, $cy)
    $g.RotateTransform(-18)
    $ow = 116.0 * $u
    $oh = 44.0 * $u
    $ox = -58.0 * $u
    $oy = -22.0 * $u
    $g.DrawEllipse($orbit, $ox, $oy, $ow, $oh)
    $g.ResetTransform()
    $orbit.Dispose()

    # Almendra del ojo.
    $eye = New-Object System.Drawing.Drawing2D.GraphicsPath
    $eye.AddBezier(12 * $u, 64 * $u, 40 * $u, 30 * $u, 88 * $u, 30 * $u, 116 * $u, 64 * $u)
    $eye.AddBezier(116 * $u, 64 * $u, 88 * $u, 98 * $u, 40 * $u, 98 * $u, 12 * $u, 64 * $u)
    $eyeFill = New-Object System.Drawing.SolidBrush($navy)
    $g.FillPath($eyeFill, $eye)
    $eyeFill.Dispose()

    # Iris-globo recortado al ojo.
    $g.SetClip($eye)
    $ri = 26.0 * $u
    $ix = $cx - $ri
    $iy = $cy - $ri
    $id = $ri * 2.0
    $irisRect = New-Object System.Drawing.RectangleF($ix, $iy, $id, $id)
    $irisTop = [System.Drawing.Color]::FromArgb(255, 143, 233, 251)
    $irisBottom = [System.Drawing.Color]::FromArgb(255, 11, 44, 78)
    $gradMode = [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    $iris = New-Object System.Drawing.Drawing2D.LinearGradientBrush($irisRect, $irisTop, $irisBottom, $gradMode)
    $g.FillEllipse($iris, $irisRect)
    $merColor = [System.Drawing.Color]::FromArgb(200, 216, 246, 255)
    $merWidth = 2.0 * $u
    $mer = New-Object System.Drawing.Pen($merColor, $merWidth)
    $mrx = $cx - 11.0 * $u
    $mry = $cy - 26.0 * $u
    $mw = 22.0 * $u
    $mh = 52.0 * $u
    $g.DrawEllipse($mer, $mrx, $mry, $mw, $mh)
    $lx1 = 38.0 * $u
    $lx2 = 90.0 * $u
    $g.DrawLine($mer, $lx1, $cy, $lx2, $cy)
    # Pupila + brillo.
    $pupilColor = [System.Drawing.Color]::FromArgb(255, 4, 7, 15)
    $pupilBrush = New-Object System.Drawing.SolidBrush($pupilColor)
    $pr = 8.5 * $u
    $g.FillEllipse($pupilBrush, ($cx - $pr), ($cy - $pr), ($pr * 2.0), ($pr * 2.0))
    $white = [System.Drawing.Color]::White
    $hiBrush = New-Object System.Drawing.SolidBrush($white)
    $hr = 2.6 * $u
    $hx = (61.0 * $u) - $hr
    $hy = (61.0 * $u) - $hr
    $hd = $hr * 2.0
    $g.FillEllipse($hiBrush, $hx, $hy, $hd, $hd)
    $g.ResetClip()

    # Contorno del ojo.
    $outlineColor = [System.Drawing.Color]::FromArgb(255, 232, 238, 245)
    $outlineWidth = 5.0 * $u
    $outline = New-Object System.Drawing.Pen($outlineColor, $outlineWidth)
    $g.DrawPath($outline, $eye)

    $iris.Dispose()
    $mer.Dispose()
    $pupilBrush.Dispose()
    $hiBrush.Dispose()
    $outline.Dispose()
    $eye.Dispose()
    $g.Dispose()
    $png = [System.Drawing.Imaging.ImageFormat]::Png
    $bmp.Save($Path, $png)
    $bmp.Dispose()
    Write-Output "OK $Path ($Size px)"
}

$publicDir = Join-Path (Join-Path $PSScriptRoot '..') 'public'
$logo512 = Join-Path $publicDir 'logo-512.png'
$logo192 = Join-Path $publicDir 'logo-192.png'
New-GeoVistaLogo -Size 512 -Path $logo512
New-GeoVistaLogo -Size 192 -Path $logo192
