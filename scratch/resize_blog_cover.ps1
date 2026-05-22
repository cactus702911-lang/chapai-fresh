Add-Type -AssemblyName System.Drawing

$Path = "c:\Users\Maruf\Downloads\Chapai Fresh\images\blog-litchi.jpg"
if (Test-Path $Path) {
    $img = [System.Drawing.Image]::FromFile($Path)
    $targetWidth = 800
    $targetHeight = 500
    $resized = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $targetWidth, $targetHeight)
    $g.Dispose()
    $img.Dispose()
    Remove-Item $Path -Force
    $resized.Save($Path, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $resized.Dispose()
    Write-Host "Blog cover image resized!" -ForegroundColor Green
} else {
    Write-Host "Image not found!" -ForegroundColor Red
}
