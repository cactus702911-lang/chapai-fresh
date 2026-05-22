# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

function Process-Crop-And-Resize-Image {
    param (
        [string]$SourcePath,
        [string]$DestPath,
        [int]$TargetWidth,
        [int]$TargetHeight
    )
    
    if (-not (Test-Path $SourcePath)) {
        Write-Host "Source file not found: $SourcePath" -ForegroundColor Red
        return
    }

    Write-Host "Processing: $SourcePath" -ForegroundColor Cyan
    
    # Load original image
    $originalImage = [System.Drawing.Image]::FromFile($SourcePath)
    $bmp = New-Object System.Drawing.Bitmap($originalImage)
    $width = $bmp.Width
    $height = $bmp.Height
    $originalImage.Dispose() # release file handle
    
    # Helper to check if a pixel is near-white (background)
    function Is-Near-White([System.Drawing.Color]$color) {
        return ($color.R -ge 240 -and $color.G -ge 240 -and $color.B -ge 240)
    }
    
    # Find bounding box of non-white content
    $minX = $width
    $maxX = 0
    $minY = $height
    $maxY = 0
    $hasContent = $false
    
    for ($y = 0; $y -lt $height; $y++) {
        for ($x = 0; $x -lt $width; $x++) {
            $c = $bmp.GetPixel($x, $y)
            if (-not (Is-Near-White $c)) {
                $hasContent = $true
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    if (-not $hasContent) {
        Write-Host "No non-white content found in image!" -ForegroundColor Yellow
        $minX = 0
        $maxX = $width - 1
        $minY = 0
        $maxY = $height - 1
    }
    
    # Add padding of 15 pixels around content
    $padding = 15
    $minX = [Math]::Max(0, $minX - $padding)
    $minY = [Math]::Max(0, $minY - $padding)
    $maxX = [Math]::Min($width - 1, $maxX + $padding)
    $maxY = [Math]::Min($height - 1, $maxY + $padding)
    
    $cropWidth = $maxX - $minX + 1
    $cropHeight = $maxY - $minY + 1
    
    Write-Host "Bounding box: X=$minX..$maxX, Y=$minY..$maxY (Size: $cropWidth x $cropHeight)"
    
    # Crop the image to bounding box
    $croppedBmp = New-Object System.Drawing.Bitmap($cropWidth, $cropHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($croppedBmp)
    $rectDest = New-Object System.Drawing.Rectangle(0, 0, $cropWidth, $cropHeight)
    $rectSrc = New-Object System.Drawing.Rectangle($minX, $minY, $cropWidth, $cropHeight)
    $graphics.DrawImage($bmp, $rectDest, $rectSrc, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    $bmp.Dispose()
    
    # Run BFS Flood fill transparency from the borders of the cropped image
    $visited = New-Object 'System.Boolean[,]' $cropWidth, $cropHeight
    $transparentColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    $queue = New-Object System.Collections.Queue
    
    # Add border seeds of cropped image
    for ($x = 0; $x -lt $cropWidth; $x++) {
        $c = $croppedBmp.GetPixel($x, 0)
        if (Is-Near-White $c) {
            $queue.Enqueue(@($x, 0))
            $visited[$x, 0] = $true
        }
        $c = $croppedBmp.GetPixel($x, ($cropHeight - 1))
        if (Is-Near-White $c) {
            $queue.Enqueue(@($x, ($cropHeight - 1)))
            $visited[$x, ($cropHeight - 1)] = $true
        }
    }
    for ($y = 1; $y -lt ($cropHeight - 1); $y++) {
        $c = $croppedBmp.GetPixel(0, $y)
        if (Is-Near-White $c) {
            $queue.Enqueue(@(0, $y))
            $visited[0, $y] = $true
        }
        $c = $croppedBmp.GetPixel(($cropWidth - 1), $y)
        if (Is-Near-White $c) {
            $queue.Enqueue(@(($cropWidth - 1), $y))
            $visited[($cropWidth - 1), $y] = $true
        }
    }
    
    # BFS Flood fill
    $dx = @(0, 0, -1, 1)
    $dy = @(-1, 1, 0, 0)
    $removedCount = 0
    
    while ($queue.Count -gt 0) {
        $curr = $queue.Dequeue()
        $cx = $curr[0]
        $cy = $curr[1]
        
        $croppedBmp.SetPixel($cx, $cy, $transparentColor)
        $removedCount++
        
        for ($i = 0; $i -lt 4; $i++) {
            $nx = $cx + $dx[$i]
            $ny = $cy + $dy[$i]
            if ($nx -ge 0 -and $nx -lt $cropWidth -and $ny -ge 0 -and $ny -lt $cropHeight) {
                if (-not $visited[$nx, $ny]) {
                    $visited[$nx, $ny] = $true
                    $nc = $croppedBmp.GetPixel($nx, $ny)
                    if (Is-Near-White $nc) {
                        $queue.Enqueue(@($nx, $ny))
                    }
                }
            }
        }
    }
    Write-Host "Made $removedCount pixels transparent on cropped image."
    
    # Now resize the cropped & transparent image to target dimensions
    Write-Host "Resizing cropped image to: $TargetWidth x $TargetHeight"
    $resizedBitmap = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight)
    $resizeGraphics = [System.Drawing.Graphics]::FromImage($resizedBitmap)
    
    # High quality scaling settings
    $resizeGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resizeGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $resizeGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $resizeGraphics.Clear([System.Drawing.Color]::Transparent)
    $resizeGraphics.DrawImage($croppedBmp, 0, 0, $TargetWidth, $TargetHeight)
    $resizeGraphics.Dispose()
    $croppedBmp.Dispose()
    
    # Ensure destination directory exists
    $destDir = Split-Path $DestPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    # Save the processed & resized image
    if (Test-Path $DestPath) {
        Remove-Item $DestPath -Force
    }
    $resizedBitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resizedBitmap.Dispose()
    Write-Host "Saved cropped, transparent, and optimized image to: $DestPath" -ForegroundColor Green
}

# Run for Logo (256x256) and Favicon (64x64) using the original generated image
Process-Crop-And-Resize-Image -SourcePath "C:\Users\Maruf\.gemini\antigravity\brain\a82d3c30-e51a-47fa-abba-62c7995ec581\chapai_fresh_logo_1779425199948.png" -DestPath "c:\Users\Maruf\Downloads\Chapai Fresh\images\logo\logo.png" -TargetWidth 256 -TargetHeight 256
Process-Crop-And-Resize-Image -SourcePath "C:\Users\Maruf\.gemini\antigravity\brain\a82d3c30-e51a-47fa-abba-62c7995ec581\chapai_fresh_logo_1779425199948.png" -DestPath "c:\Users\Maruf\Downloads\Chapai Fresh\images\logo\favicon.png" -TargetWidth 64 -TargetHeight 64
