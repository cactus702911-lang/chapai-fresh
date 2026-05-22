Add-Type -AssemblyName System.Drawing

$Path = "c:\Users\Maruf\Downloads\Chapai Fresh\images\product-litchi.png"
if (Test-Path $Path) {
    $img = [System.Drawing.Image]::FromFile($Path)
    $targetWidth = 512
    $targetHeight = 512
    $resized = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
    $g.Dispose()
    $img.Dispose()
    Remove-Item $Path -Force
    $resized.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    Write-Host "Resized and optimized litchi image!" -ForegroundColor Green
} else {
    Write-Host "Image not found!" -ForegroundColor Red
}
