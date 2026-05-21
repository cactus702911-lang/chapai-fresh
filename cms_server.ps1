# Chapai Fresh CMS Local Server
# Listens on http://localhost:8085

# Force PowerShell to use UTF-8 for external process output decoding and standard streams
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$port = 8085
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

function Get-MimeType ($extension) {
    switch ($extension) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".gif"  { return "image/gif" }
        ".webp" { return "image/webp" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "🌾 Chapai Fresh CMS Local Server Started!" -ForegroundColor Green
    Write-Host "👉 Admin Panel:   http://localhost:$port/admin" -ForegroundColor Cyan
    Write-Host "👉 Store Frontend: http://localhost:$port/" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C in this terminal window to stop the server." -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        $method = $request.HttpMethod

        # Redirect .html requests to extensionless counterparts (Clean URLs)
        if ($path -like "*.html" -and $method -eq "GET") {
            $cleanPath = $path.Substring(0, $path.Length - 5)
            if ($cleanPath -eq "/index") {
                $cleanPath = "/"
            }
            # Append query string if present
            if ($request.Url.Query) {
                $cleanPath = $cleanPath + $request.Url.Query
            }
            Write-Host "[Redirect] $path -> $cleanPath" -ForegroundColor Yellow
            $response.StatusCode = 301
            $response.Headers.Add("Location", $cleanPath)
            $response.Close()
            continue
        }

        # Add CORS Headers for local development convenience
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($method -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # ----------------------------------------------------
        # API Endpoints
        # ----------------------------------------------------
        
        # GET /api/data -> Returns site_data.js as clean JSON
        if ($path -eq "/api/data" -and $method -eq "GET") {
            Write-Host "[API] GET /api/data request received" -ForegroundColor Gray
            try {
                $json = node "$PSScriptRoot\data_manager.js" get
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            catch {
                $err = '{"error":"' + $_.Exception.Message.Replace('"', '\"') + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # POST /api/save -> Save JSON to site_data.js and rebuild site
        if ($path -eq "/api/save" -and $method -eq "POST") {
            Write-Host "[API] POST /api/save request received" -ForegroundColor Gray
            try {
                # Read Body
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                # Write to temp file
                $tempFile = Join-Path $PSScriptRoot "temp_data.json"
                [System.IO.File]::WriteAllText($tempFile, $body, [System.Text.Encoding]::UTF8)

                # Save via node script
                Write-Host "[API] Saving database changes..." -ForegroundColor Yellow
                $saveOutput = node "$PSScriptRoot\data_manager.js" save "$tempFile"
                Write-Host $saveOutput -ForegroundColor Cyan
                if ($LASTEXITCODE -ne 0) {
                    throw "data_manager.js failed with exit code $LASTEXITCODE. Output: $saveOutput"
                }

                # Rebuild site
                Write-Host "[API] Rebuilding static site..." -ForegroundColor Yellow
                $buildOutput = node "$PSScriptRoot\build_site.js"
                Write-Host $buildOutput -ForegroundColor Green
                if ($LASTEXITCODE -ne 0) {
                    throw "build_site.js failed with exit code $LASTEXITCODE. Output: $buildOutput"
                }

                $responseText = '{"status":"success","message":"Data saved and website rebuilt successfully."}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            catch {
                $err = '{"error":"' + $_.Exception.Message.Replace('"', '\"') + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # POST /api/reviews/submit -> Customer submits a product review
        if ($path -eq "/api/reviews/submit" -and $method -eq "POST") {
            Write-Host "[API] POST /api/reviews/submit request received" -ForegroundColor Gray
            try {
                # Read Body
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()

                # Write to temp file
                $tempFile = Join-Path $PSScriptRoot "temp_review.json"
                [System.IO.File]::WriteAllText($tempFile, $body, [System.Text.Encoding]::UTF8)

                # Save review via node script
                Write-Host "[API] Submitting customer review..." -ForegroundColor Yellow
                $submitOutput = node "$PSScriptRoot\data_manager.js" submit-review "$tempFile"
                Write-Host $submitOutput -ForegroundColor Cyan
                if ($LASTEXITCODE -ne 0) {
                    throw "data_manager.js failed with exit code $LASTEXITCODE. Output: $submitOutput"
                }

                # Rebuild site
                Write-Host "[API] Rebuilding static site..." -ForegroundColor Yellow
                $buildOutput = node "$PSScriptRoot\build_site.js"
                Write-Host $buildOutput -ForegroundColor Green
                if ($LASTEXITCODE -ne 0) {
                    throw "build_site.js failed with exit code $LASTEXITCODE. Output: $buildOutput"
                }

                $responseText = '{"status":"success","message":"Review submitted and website rebuilt successfully."}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            catch {
                $err = '{"error":"' + $_.Exception.Message.Replace('"', '\"') + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # POST /api/build -> Manually trigger website rebuild
        if ($path -eq "/api/build" -and $method -eq "POST") {
            Write-Host "[API] POST /api/build manual rebuild requested" -ForegroundColor Gray
            try {
                Write-Host "[API] Rebuilding static site..." -ForegroundColor Yellow
                $buildOutput = node "$PSScriptRoot\build_site.js"
                Write-Host $buildOutput -ForegroundColor Green
                if ($LASTEXITCODE -ne 0) {
                    throw "build_site.js failed with exit code $LASTEXITCODE. Output: $buildOutput"
                }

                $responseText = '{"status":"success","message":"Website rebuilt successfully."}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseText)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            catch {
                $err = '{"error":"' + $_.Exception.Message.Replace('"', '\"') + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # GET /api/images -> Lists all image assets in root for Admin image picker
        if ($path -eq "/api/images" -and $method -eq "GET") {
            Write-Host "[API] GET /api/images request received" -ForegroundColor Gray
            try {
                $files = Get-ChildItem -Path "$PSScriptRoot\images" -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png|webp|svg)$' }
                $imageNames = $files | ForEach-Object { "images/" + $_.Name }
                
                # Convert to JSON array
                $json = ConvertTo-Json -InputObject $imageNames
                
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            catch {
                $err = '[]'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($err)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            $response.Close()
            continue
        }

        # ----------------------------------------------------
        # Static File Serving
        # ----------------------------------------------------
        
        # Default document
        $localPath = $path
        if ($localPath -eq "/") {
            $localPath = "/index.html"
        }

        # Clean path formatting and locate file on disk
        $cleanedPath = $localPath.Replace('/', '\').TrimStart('\')
        $filePath = Join-Path $PSScriptRoot $cleanedPath

        # Check if file exists with .html extension for clean URLs
        if (-not (Test-Path $filePath -PathType Leaf) -and -not [System.IO.Path]::GetExtension($filePath)) {
            $htmlFilePath = $filePath + ".html"
            if (Test-Path $htmlFilePath -PathType Leaf) {
                $filePath = $htmlFilePath
            }
        }

        if (Test-Path $filePath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($filePath)
            $contentType = Get-MimeType $extension
            
            try {
                # Read file as bytes (handles HTML, CSS, JS, and Binary images correctly)
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.StatusCode = 200
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            catch {
                $response.StatusCode = 500
                $response.ContentType = "text/plain"
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Error reading file: " + $_.Exception.Message)
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
        }
        else {
            # File Not Found
            Write-Host "404 Not Found: $path" -ForegroundColor Red
            $response.StatusCode = 404
            $response.ContentType = "text/html; charset=utf-8"
            $html404 = "<html><body><h1>404 File Not Found</h1><p>The requested path <b>$path</b> does not exist.</p></body></html>"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($html404)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        
        $response.Close()
    }
}
finally {
    $listener.Close()
    Write-Host "Server stopped." -ForegroundColor Red
}
