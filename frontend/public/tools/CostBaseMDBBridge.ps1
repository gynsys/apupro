param(
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $baseDir "bridge.log"

function Write-Log([string]$message) {
    try {
        $line = "{0} {1}" -f (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"), $message
        Add-Content -Path $logPath -Value $line -Encoding UTF8
    } catch { }
}

function Send-Bytes($stream, [int]$status, [string]$contentType, [byte[]]$body, [string]$extraHeaders = "") {
    $reason = switch ($status) {
        200 { "OK" }
        204 { "No Content" }
        400 { "Bad Request" }
        413 { "Payload Too Large" }
        500 { "Internal Server Error" }
        default { "OK" }
    }
    $headers = @(
        "HTTP/1.1 $status $reason",
        "Access-Control-Allow-Origin: *",
        "Access-Control-Allow-Methods: GET, POST, OPTIONS",
        "Access-Control-Allow-Headers: Content-Type, X-Filename",
        "Access-Control-Allow-Private-Network: true",
        "Content-Type: $contentType",
        "Content-Length: $($body.Length)",
        "Connection: close"
    )
    if ($extraHeaders) { $headers += $extraHeaders }
    $headerText = ($headers -join "`r`n") + "`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($body.Length -gt 0) {
        $stream.Write($body, 0, $body.Length)
    }
    $stream.Flush()
}

function Send-Json($stream, [int]$status, $payload) {
    $json = $payload | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Send-Bytes $stream $status "application/json; charset=utf-8" $bytes
}

function Find-HeaderEnd([byte[]]$data, [int]$length) {
    for ($i = 0; $i -le $length - 4; $i++) {
        if ($data[$i] -eq 13 -and $data[$i + 1] -eq 10 -and $data[$i + 2] -eq 13 -and $data[$i + 3] -eq 10) {
            return $i
        }
    }
    return -1
}

function Read-Request($stream) {
    $buffer = New-Object byte[] 8192
    $memory = New-Object System.IO.MemoryStream
    $headerEnd = -1

    while ($headerEnd -lt 0) {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { return $null }
        $memory.Write($buffer, 0, $read)
        $arr = $memory.ToArray()
        $headerEnd = Find-HeaderEnd $arr $arr.Length
        if ($arr.Length -gt 1048576) { throw "Encabezado HTTP demasiado grande." }
    }

    $all = $memory.ToArray()
    $headerText = [System.Text.Encoding]::ASCII.GetString($all, 0, $headerEnd)
    $lines = $headerText -split "`r`n"
    $requestLine = $lines[0] -split " "
    $headers = @{}
    for ($i = 1; $i -lt $lines.Length; $i++) {
        $colon = $lines[$i].IndexOf(":")
        if ($colon -gt 0) {
            $key = $lines[$i].Substring(0, $colon).Trim().ToLower()
            $value = $lines[$i].Substring($colon + 1).Trim()
            $headers[$key] = $value
        }
    }

    $contentLength = 0
    if ($headers.ContainsKey("content-length")) {
        [int]::TryParse($headers["content-length"], [ref]$contentLength) | Out-Null
    }
    if ($contentLength -gt (100 * 1024 * 1024)) { throw "Archivo demasiado grande." }

    $bodyStart = $headerEnd + 4
    $body = New-Object byte[] $contentLength
    $already = $all.Length - $bodyStart
    if ($already -gt 0) {
        $copy = [Math]::Min($already, $contentLength)
        [Array]::Copy($all, $bodyStart, $body, 0, $copy)
    }
    $offset = [Math]::Min([Math]::Max($already, 0), $contentLength)
    while ($offset -lt $contentLength) {
        $read = $stream.Read($body, $offset, $contentLength - $offset)
        if ($read -le 0) { break }
        $offset += $read
    }

    return @{
        Method = $requestLine[0]
        Path = $requestLine[1]
        Headers = $headers
        Body = $body
    }
}

function Convert-MdbToZip([byte[]]$mdbBytes, [string]$fileName) {
    $work = Join-Path ([System.IO.Path]::GetTempPath()) ("costbase_bridge_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    $safeName = [System.IO.Path]::GetFileName($fileName)
    if (-not $safeName) { $safeName = "presupuesto.mdb" }
    $mdbPath = Join-Path $work $safeName
    [System.IO.File]::WriteAllBytes($mdbPath, $mdbBytes)

    $tables = @(
        "ObraProy", "ObraApun", "ObraPart", "ObraMate", "ObraEqui",
        "ObraMano", "ObraPainMate", "ObraPainEqui", "ObraPainMano"
    )
    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $dao = $null
    $db = $null

    try {
        $dao = New-Object -ComObject DAO.DBEngine.36
        $db = $dao.OpenDatabase($mdbPath, $false, $true)

        foreach ($name in $tables) {
            $table = $db.TableDefs.Item($name)
            $fields = @()
            for ($i = 0; $i -lt $table.Fields.Count; $i++) {
                $fields += $table.Fields.Item($i)
            }
            $csvPath = Join-Path $work ($name + ".csv")
            $writer = New-Object System.IO.StreamWriter($csvPath, $false, $utf8)
            $header = ($fields | ForEach-Object {
                '"' + ($_.Name -replace '"', '""') + '"'
            }) -join ","
            $writer.WriteLine($header)

            $rs = $db.OpenRecordset("SELECT * FROM [$name]")
            while (-not $rs.EOF) {
                $values = New-Object System.Collections.Generic.List[string]
                foreach ($field in $fields) {
                    $value = $rs.Fields.Item($field.Name).Value
                    if ($null -eq $value -or $value -is [System.DBNull]) {
                        $values.Add("")
                    } elseif ($field.Type -eq 1) {
                        if ([bool]$value) { $values.Add("1") } else { $values.Add("0") }
                    } elseif ($field.Type -eq 8) {
                        $values.Add(([datetime]$value).ToString("yyyy-MM-dd HH:mm:ss", $inv))
                    } elseif ($field.Type -eq 10 -or $field.Type -eq 12) {
                        $values.Add('"' + (([string]$value) -replace '"', '""') + '"')
                    } elseif ($field.Type -eq 6 -or $field.Type -eq 7) {
                        $values.Add(([double]$value).ToString("R", $inv))
                    } else {
                        $values.Add([string]$value)
                    }
                }
                $writer.WriteLine(($values -join ","))
                $rs.MoveNext()
            }
            $rs.Close()
            $writer.Close()
        }

        $db.Close()
        $db = $null

        $zipPath = Join-Path $work "presupuesto_csv.zip"
        Compress-Archive -Path (Join-Path $work "*.csv") -DestinationPath $zipPath -Force
        return [System.IO.File]::ReadAllBytes($zipPath)
    }
    finally {
        if ($db) { try { $db.Close() } catch { } }
        if (Test-Path $work) { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    Write-Log "Puente iniciado en 127.0.0.1:$Port"
    Write-Host "CostBase MDB Bridge escuchando en http://127.0.0.1:$Port"

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $request = Read-Request $stream
            if ($null -eq $request) { continue }

            if ($request.Method -eq "OPTIONS") {
                Send-Bytes $stream 204 "text/plain" ([byte[]]@())
                continue
            }

            if ($request.Method -eq "GET" -and $request.Path -eq "/health") {
                Send-Json $stream 200 @{ status = "ok"; service = "costbase-mdb-bridge"; port = $Port }
                continue
            }

            if ($request.Method -eq "POST" -and $request.Path -eq "/convert") {
                $fileName = "presupuesto.mdb"
                if ($request.Headers.ContainsKey("x-filename")) {
                    $fileName = [System.Uri]::UnescapeDataString($request.Headers["x-filename"])
                }
                if ($request.Body.Length -eq 0) {
                    Send-Json $stream 400 @{ detail = "No se recibio el archivo." }
                    continue
                }
                try {
                    $zip = Convert-MdbToZip $request.Body $fileName
                    Send-Bytes $stream 200 "application/zip" $zip
                    Write-Log "Convertido: $fileName ($($zip.Length) bytes)"
                } catch {
                    Write-Log "ERROR convirtiendo: $($_.Exception.Message)"
                    Send-Json $stream 500 @{ detail = $_.Exception.Message }
                }
                continue
            }

            Send-Json $stream 400 @{ detail = "Ruta no encontrada." }
        } catch {
            Write-Log "ERROR: $($_.Exception.Message)"
        } finally {
            try { $client.Close() } catch { }
        }
    }
}
catch {
    Write-Log "NO INICIO: $($_.Exception.Message)"
    Write-Host "No se pudo iniciar el puente: $($_.Exception.Message)"
    exit 1
}
