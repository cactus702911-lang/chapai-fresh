# Load System.Drawing assembly
Add-Type -AssemblyName System.Drawing

function Process-And-Resize-Image {
    param (
        [string]$Path,
        [int]$TargetWidth,
        [int]$TargetHeight
    )
    
    if (-not (Test-Path $Path)) {
        Write-Host "File not found: $Path" -ForegroundColor Red
        return
    }

    Write-Host "Processing: $Path" -ForegroundColor Cyan
    
    # Load image
    $originalImage = [System.Drawing.Image]::FromFile($Path)
    $width = $originalImage.Width
    $height = $originalImage.Height
    Write-Host "Original Dimensions: $width x $height"
    
    # Create a copy in memory as a bitmap to allow pixel editing
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.DrawImage($originalImage, 0, 0, $width, $height)
    $graphics.Dispose()
    $originalImage.Dispose() # release file handle

    # Flood fill transparency from the borders
    $visited = New-Object 'System.Boolean[,]' $width, $height
    $transparentColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
    $queue = New-Object System.Collections.Queue
    
    # Helper to check if a pixel is near-white
    function Is-Near-White([System.Drawing.Color]$color) {
        if ($color.A -eq 0) { return $false }
        return ($color.R -ge 240 -and $color.G -ge 240 -and $color.B -ge 240)
    }
    
    # Add border seeds
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bitmap.GetPixel($x, 0)
        if (Is-Near-White $c) {
            $queue.Enqueue(@($x, 0))
            $visited[$x, 0] = $true
        }
        $c = $bitmap.GetPixel($x, ($height - 1))
        if (Is-Near-White $c) {
            $queue.Enqueue(@($x, ($height - 1)))
            $visited[$x, ($height - 1)] = $true
        }
    }
    for ($y = 1; $y -lt ($height - 1); $y++) {
        $c = $bitmap.GetPixel(0, $y)
        if (Is-Near-White $c) {
            $queue.Enqueue(@(0, $y))
            $visited[0, $y] = $true
        }
        $c = $bitmap.GetPixel(($width - 1), $y)
        if (Is-Near-White $c) {
            $queue.Enqueue(@(($width - 1), $y))
            $visited[($width - 1), $y] = $true
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
        
        $bitmap.SetPixel($cx, $cy, $transparentColor)
        $removedCount++
        
        for ($i = 0; $i -lt 4; $i++) {
            $nx = $cx + $dx[$i]
            $ny = $cy + $dy[$i]
            if ($nx -ge 0 -and $nx -lt $width -and $ny -ge 0 -and $ny -lt $height) {
                if (-not $visited[$nx, $ny]) {
                    $visited[$nx, $ny] = $true
                    $nc = $bitmap.GetPixel($nx, $ny)
                    if (Is-Near-White $nc) {
                        $queue.Enqueue(@($nx, $ny))
                    }
                }
            }
        }
    }
    Write-Host "Made $removedCount pixels transparent."
    
    # Now resize the transparent image
    Write-Host "Resizing to: $TargetWidth x $TargetHeight"
    $resizedBitmap = New-Object System.Drawing.Bitmap($TargetWidth, $TargetHeight)
    $resizeGraphics = [System.Drawing.Graphics]::FromImage($resizedBitmap)
    
    # High quality scaling settings
    $resizeGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $resizeGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $resizeGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $resizeGraphics.Clear([System.Drawing.Color]::Transparent)
    $resizeGraphics.DrawImage($bitmap, 0, 0, $TargetWidth, $TargetHeight)
    $resizeGraphics.Dispose()
    $bitmap.Dispose()
    
    # Save the processed & resized image
    $tempPath = $Path + ".tmp.png"
    $resizedBitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resizedBitmap.Dispose()
    
    # Replace original with temp
    Remove-Item $Path -Force
    Rename-Item $tempPath (Split-Path $Path -Leaf)
    Write-Host "Saved optimized image to: $Path" -ForegroundColor Green
}

# Process both
Process-And-Resize-Image -Path "c:\Users\Maruf\Downloads\Chapai Fresh\images\logo\logo.png" -TargetWidth 256 -TargetHeight 256
Process-And-Resize-Image -Path "c:\Users\Maruf\Downloads\Chapai Fresh\images\logo\favicon.png" -TargetWidth 64 -TargetHeight 64
