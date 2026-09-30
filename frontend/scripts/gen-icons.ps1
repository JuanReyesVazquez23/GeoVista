# Genera los iconos PWA de GeoVista (globo cyan sobre navy).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/gen-icons.ps1
Add-Type -AssemblyName System.Drawing

function New-GeoVistaIcon {
    param([int]$Size, [string]$Path, [double]$GlobeRatio = 0.32)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $g.Clear([System.Drawing.Color]::FromArgb(255, 4, 7, 15))

    $cx = $Size / 2
    $cy = $Size / 2
    $r = $Size * $GlobeRatio
    $rect = New-Object System.Drawing.RectangleF(($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
        [System.Drawing.Color]::FromArgb(255, 34, 211, 238),
        [System.Drawing.Color]::FromArgb(255, 10, 40, 75),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    $g.FillEllipse($brush, $rect)

    # Brillo superior del globo.
    $hi = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 255, 255, 255))
    $g.FillEllipse($hi, ($cx - $r * 0.55), ($cy - $r * 0.75), ($r * 0.7), ($r * 0.45))

    # Anillo de atmósfera.
    $penWidth = [Math]::Max(2, $Size * 0.008)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 56, 189, 248), $penWidth)
    $pad = 4 + $penWidth
    $g.DrawEllipse($pen, ($cx - $r - $pad), ($cy - $r - $pad), (($r + $pad) * 2), (($r + $pad) * 2))

    $brush.Dispose()
    $hi.Dispose()
    $pen.Dispose()
    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "OK $Path ($Size px)"
}

$out = Join-Path (Join-Path $PSScriptRoot '..') 'public'
New-GeoVistaIcon -Size 192 -Path (Join-Path $out 'icon-192.png')
New-GeoVistaIcon -Size 512 -Path (Join-Path $out 'icon-512.png')
New-GeoVistaIcon -Size 512 -Path (Join-Path $out 'maskable-512.png') -GlobeRatio 0.26
New-GeoVistaIcon -Size 180 -Path (Join-Path $out 'apple-touch-icon.png')
