# Exporta un presupuesto Maprex/Lulo a CSV dentro de un ZIP
# para importarlo desde Costbase cuando el .mdb es Access 1.0/2.0.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File exportar_mdb_windows.ps1
#
# El ZIP se genera en el Escritorio.

param(
    [string]$MdbPath = ""
)

$ErrorActionPreference = "Stop"

# DAO suele ser de 32 bits. Si estamos en PowerShell de 64 bits, relanzar.
if ([Environment]::Is64BitProcess) {
    $ps32 = Join-Path $env:WINDIR "SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
    if (-not (Test-Path $ps32)) {
        throw "No se encontró PowerShell de 32 bits."
    }
    & $ps32 -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -MdbPath $MdbPath
    exit $LASTEXITCODE
}

if (-not $MdbPath) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "Selecciona el archivo MDB de Maprex/Lulo"
    $dialog.Filter = "Access (*.mdb;*.accdb;*.prx)|*.mdb;*.accdb;*.prx|Todos (*.*)|*.*"
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        exit 0
    }
    $MdbPath = $dialog.FileName
}

if (-not (Test-Path $MdbPath)) {
    throw "No existe el archivo: $MdbPath"
}

$tables = @(
    "ObraProy",
    "ObraApun",
    "ObraPart",
    "ObraMate",
    "ObraEqui",
    "ObraMano",
    "ObraPainMate",
    "ObraPainEqui",
    "ObraPainMano"
)

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("costbase_mdb_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $work | Out-Null

$inv = [System.Globalization.CultureInfo]::InvariantCulture
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Csv([string]$value) {
    return '"' + ($value -replace '"', '""') + '"'
}

try {
    $dao = New-Object -ComObject DAO.DBEngine.36
    $db = $dao.OpenDatabase($MdbPath, $false, $true)

    foreach ($name in $tables) {
        $table = $db.TableDefs.Item($name)
        $fields = @()
        for ($i = 0; $i -lt $table.Fields.Count; $i++) {
            $fields += $table.Fields.Item($i)
        }

        $csvPath = Join-Path $work ($name + ".csv")
        $writer = New-Object System.IO.StreamWriter($csvPath, $false, $utf8)
        $writer.WriteLine((($fields | ForEach-Object { Csv $_.Name }) -join ","))

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
                    $values.Add((Csv ([string]$value)))
                } elseif ($field.Type -eq 6 -or $field.Type -eq 7) {
                    $values.Add(([double]$value).ToString("R", $inv))
                } else {
                    $values.Add(([string]$value))
                }
            }
            $writer.WriteLine(($values -join ","))
            $rs.MoveNext()
        }
        $rs.Close()
        $writer.Close()
        Write-Host "Exportado: $name"
    }

    $db.Close()

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($MdbPath)
    $zipPath = Join-Path ([Environment]::GetFolderPath("Desktop")) ($baseName + "_csv.zip")
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $work "*.csv") -DestinationPath $zipPath -Force

    Write-Host ""
    Write-Host "ZIP generado:"
    Write-Host $zipPath
    Write-Host ""
    Write-Host "Súbelo en Costbase -> Gestor de Presupuestos -> Importar MDB."
}
finally {
    if (Test-Path $work) {
        Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}
