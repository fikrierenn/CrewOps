# CrewOps: Belirtilen port(lar)ı dinleyen süreçleri sonlandırır.
# Kullanım: .\scripts\kill-port.ps1 3000
#          .\scripts\kill-port.ps1 3000 3999

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [int[]]$Ports
)

foreach ($port in $Ports) {
  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $pid = $conn.OwningProcess
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Port $port -> PID $pid ($($proc.ProcessName)) sonlandiriliyor..."
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      Write-Host "  -> Kapatildi."
    }
  } else {
    Write-Host "Port $port uzerinde dinleyen surec yok."
  }
}
