$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "..\Guide_utilisation_QA.docx" | Resolve-Path
$desktop = [Environment]::GetFolderPath("Desktop")
$destDesktop = Join-Path $desktop "Guide_utilisation_QA.docx"
$destLocal = Join-Path (Split-Path $src) "Guide_QA.docx"

Copy-Item -LiteralPath $src -Destination $destDesktop -Force
Copy-Item -LiteralPath $src -Destination $destLocal -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open([string]$src)
  $wdFormatXMLDocument = 16
  $doc.SaveAs2([string]$destDesktop, $wdFormatXMLDocument)
  $doc.SaveAs2([string]$destLocal, $wdFormatXMLDocument)
  $doc.Close($false)
} finally {
  $word.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output $destDesktop
Write-Output $destLocal
