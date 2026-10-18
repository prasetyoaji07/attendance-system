# Smoke test API roster (pola shift, generate jadwal, validasi jeda 11 jam) terhadap server yang sedang jalan.
# Jalankan di PowerShell dari folder server, setelah `npm run dev` aktif di jendela lain:
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-roster.ps1
# Butuh akun HRD (default: NIK 1001 / rahasia123).
# Catatan data uji: roster tidak bisa dihapus lewat API, jadi shift "Smoke R ...", lokasi "Smoke R Lokasi",
# dan pola "Smoke R ..." dibuat sekali lalu dipakai ulang di run berikutnya. Karyawan uji dibuat baru tiap run
# (jadwal ada di tanggal 2027-03-01 dst.) dan dinonaktifkan di akhir.
param(
  [string]$Base = 'http://localhost:3001/api',
  [string]$Nik = '1001',
  [string]$Password = 'rahasia123'
)

$ErrorActionPreference = 'Stop'
$script:ok = 0
$script:bad = 0

function Check([string]$name, [bool]$cond) {
  if ($cond) { Write-Host "  [OK]    $name" -ForegroundColor Green; $script:ok++ }
  else { Write-Host "  [GAGAL] $name" -ForegroundColor Red; $script:bad++ }
}

function Call([string]$method, [string]$path, $body = $null, [string]$token = '') {
  $headers = @{}
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $args2 = @{ Method = $method; Uri = "$Base$path"; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $body) {
    $args2['Body'] = ($body | ConvertTo-Json -Depth 6)
    $args2['ContentType'] = 'application/json'
  }
  try {
    $r = Invoke-WebRequest @args2
    $json = $null
    if ($r.Content) { $json = $r.Content | ConvertFrom-Json }
    return @{ Status = [int]$r.StatusCode; Body = $json }
  } catch {
    if ($null -eq $_.Exception.Response) { throw }
    $status = [int]$_.Exception.Response.StatusCode
    $json = $null
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      try { $json = $_.ErrorDetails.Message | ConvertFrom-Json } catch { }
    }
    return @{ Status = $status; Body = $json }
  }
}

function Login([string]$nik, [string]$pw) {
  return Call 'POST' '/auth/login' @{ nik = $nik; password = $pw }
}

function EnsureShift([string]$name, [string]$start, [string]$end, [string]$token) {
  $list = Call 'GET' '/shifts' $null $token
  $found = @($list.Body.data) | Where-Object { $_.nama -eq $name } | Select-Object -First 1
  if ($null -ne $found) { return $found.id }
  $r = Call 'POST' '/shifts' @{ nama = $name; jamMulai = $start; jamSelesai = $end } $token
  return $r.Body.data.id
}

function EnsurePattern([string]$name, $urutan, [string]$token) {
  $list = Call 'GET' '/roster/patterns' $null $token
  $found = @($list.Body.data) | Where-Object { $_.nama -eq $name } | Select-Object -First 1
  if ($null -ne $found) { return $found.id }
  $r = Call 'POST' '/roster/patterns' @{ nama = $name; urutan = @($urutan) } $token
  return $r.Body.data.id
}

$sfx = Get-Date -Format 'MMddHHmmss'
Write-Host "Smoke test roster ($sfx)" -ForegroundColor Cyan

$l = Login $Nik $Password
if ($l.Status -ne 200) { Write-Host "Login HRD gagal (status $($l.Status)). Cek NIK/password dan server." -ForegroundColor Red; exit 1 }
$hrd = $l.Body.token
Check 'login HRD' ($l.Body.user.role -eq 'HRD' -or $l.Body.user.role -eq 'ADMIN')

# ---------- Persiapan data uji ----------
Write-Host 'Persiapan'
$pagi = 'Smoke R Pagi'; $siang = 'Smoke R Siang'; $malam = 'Smoke R Malam'
$pagiId = EnsureShift $pagi '06:00' '14:00' $hrd
$siangId = EnsureShift $siang '14:00' '22:00' $hrd
$malamId = EnsureShift $malam '22:00' '06:00' $hrd
Check 'tiga shift uji siap' ($pagiId -gt 0 -and $siangId -gt 0 -and $malamId -gt 0)

$locs = Call 'GET' '/locations' $null $hrd
$loc = @($locs.Body.data) | Where-Object { $_.nama -eq 'Smoke R Lokasi' } | Select-Object -First 1
if ($null -eq $loc) {
  $r = Call 'POST' '/locations' @{ nama = 'Smoke R Lokasi'; lat = -6.3; lng = 107.15 } $hrd
  $locId = $r.Body.data.id
} else { $locId = $loc.id }
Check 'lokasi uji siap' ($locId -gt 0)

$aman = EnsurePattern 'Smoke R Aman' @($pagi, $pagi, $siang, $siang, $malam, $malam, 'libur', 'libur') $hrd
$salah = EnsurePattern 'Smoke R Salah' @($siang, $pagi) $hrd
$pagiLibur = EnsurePattern 'Smoke R Pagi Libur' @($pagi, 'libur') $hrd
Check 'tiga pola uji siap' ($aman -gt 0 -and $salah -gt 0 -and $pagiLibur -gt 0)

$d = Call 'GET' '/employees/departments' $null $hrd
$dept = @($d.Body.data) | Where-Object { $_.nama -eq 'Smoke Test' } | Select-Object -First 1
if ($null -eq $dept) { $r = Call 'POST' '/employees/departments' @{ nama = 'Smoke Test' } $hrd; $deptId = $r.Body.data.id } else { $deptId = $dept.id }

$nik1 = "SMR1$sfx"; $nik2 = "SMR2$sfx"
$r = Call 'POST' '/employees' @{ nik = $nik1; nama = 'Roster Smoke 1'; departmentId = $deptId; tanggalMasuk = '2026-10-01'; password = 'rahasia123' } $hrd
$e1 = $r.Body.data.id
$r = Call 'POST' '/employees' @{ nik = $nik2; nama = 'Roster Smoke 2'; departmentId = $deptId; tanggalMasuk = '2026-10-01'; password = 'rahasia123' } $hrd
$e2 = $r.Body.data.id
Check 'dua karyawan uji dibuat' ($e1 -gt 0 -and $e2 -gt 0)

# ---------- Pola ----------
Write-Host 'Pola shift'
$r = Call 'GET' '/roster/patterns' $null $hrd
Check 'GET /roster/patterns 200' ($r.Status -eq 200)
$r = Call 'POST' '/roster/patterns' @{ nama = "Salah $sfx"; urutan = @('sore') } $hrd
Check 'pola dengan shift tak dikenal 400' ($r.Status -eq 400)
$r = Call 'POST' '/roster/patterns' @{ nama = "Libur $sfx"; urutan = @('libur', 'libur') } $hrd
Check 'pola libur semua 400' ($r.Status -eq 400)
$r = Call 'POST' '/roster/patterns' @{ nama = 'Smoke R Aman'; urutan = @($pagi) } $hrd
Check 'nama pola kembar 409' ($r.Status -eq 409)

# ---------- Generate ----------
Write-Host 'Generate'
$from = '2027-03-01'; $to = '2027-03-16'
$body = @{ patternId = $aman; locationId = $locId; from = $from; to = $to; employees = @(@{ employeeId = $e1 }); dryRun = $true }
$r = Call 'POST' '/roster/generate' $body $hrd
Check 'dryRun 200, 12 roster akan dibuat (16 hari, 2 siklus, libur dilewati)' ($r.Status -eq 200 -and $r.Body.data.created -eq 12 -and $r.Body.data.dryRun -eq $true)
$r = Call 'GET' "/roster?from=$from&to=$to&employeeId=$e1" $null $hrd
Check 'dryRun tidak menyimpan apa pun' ($r.Status -eq 200 -and @($r.Body.data).Count -eq 0)

$body['dryRun'] = $false
$r = Call 'POST' '/roster/generate' $body $hrd
Check 'generate 201, created 12' ($r.Status -eq 201 -and $r.Body.data.created -eq 12)
$r = Call 'GET' "/roster?from=$from&to=$to&employeeId=$e1" $null $hrd
$rows = @($r.Body.data)
Check 'GET /roster mengembalikan 12 baris' ($r.Status -eq 200 -and $rows.Count -eq 12)
Check 'tanggal pertama tidak bergeser (2027-03-01)' ($rows[0].shiftDate -eq '2027-03-01' -and $rows[0].shiftNama -eq $pagi)
$mal = $rows | Where-Object { $_.shiftNama -eq $malam } | Select-Object -First 1
Check 'shift malam: lintasHari true, jam 22:00-06:00' ($mal.lintasHari -eq $true -and $mal.jamMulai -eq '22:00' -and $mal.jamSelesai -eq '06:00')
Check 'hari libur tidak punya baris (2027-03-07 dan 03-08)' (@($rows | Where-Object { $_.shiftDate -eq '2027-03-07' -or $_.shiftDate -eq '2027-03-08' }).Count -eq 0)

$r = Call 'POST' '/roster/generate' $body $hrd
Check 'generate ulang: created 0, skipped 12, tidak menimpa' ($r.Status -eq 201 -and $r.Body.data.created -eq 0 -and @($r.Body.data.skipped).Count -eq 12)

# ---------- Jeda 11 jam ----------
Write-Host 'Jeda minimal 11 jam'
$r = Call 'POST' '/roster/generate' @{ patternId = $salah; locationId = $locId; from = $from; to = '2027-03-04'; employees = @(@{ employeeId = $e2 }) } $hrd
Check 'pola siang lalu pagi ditolak 409 REST_VIOLATION' ($r.Status -eq 409 -and $r.Body.error.code -eq 'REST_VIOLATION')
Check 'rincian pelanggaran: jeda 8 jam' (@($r.Body.error.details).Count -gt 0 -and $r.Body.error.details[0].restHours -eq 8)
$r = Call 'GET' "/roster?from=$from&to=2027-03-04&employeeId=$e2" $null $hrd
Check 'ditolak berarti tidak ada yang tersimpan (all-or-nothing)' (@($r.Body.data).Count -eq 0)

$r = Call 'POST' '/roster/generate' @{ patternId = $aman; locationId = $locId; from = $from; to = $from; employees = @(@{ employeeId = $e2; offset = 2 }) } $hrd
Check 'offset 2: karyawan 2 mulai dari shift siang' ($r.Status -eq 201 -and $r.Body.data.created -eq 1)
$r = Call 'GET' "/roster?from=$from&to=$from&employeeId=$e2" $null $hrd
Check 'baris karyawan 2 pada 2027-03-01 = siang' (@($r.Body.data)[0].shiftNama -eq $siang)
$r = Call 'POST' '/roster/generate' @{ patternId = $pagiLibur; locationId = $locId; from = '2027-03-02'; to = '2027-03-02'; employees = @(@{ employeeId = $e2 }) } $hrd
Check 'jeda dicek terhadap roster yang sudah ada (siang 03-01 lalu pagi 03-02) 409' ($r.Status -eq 409 -and $r.Body.error.code -eq 'REST_VIOLATION')

# ---------- Validasi input dan RBAC ----------
Write-Host 'Validasi dan RBAC'
$r = Call 'POST' '/roster/generate' @{ patternId = $aman; locationId = $locId; from = '2027-03-01'; to = '2027-06-01'; employees = @(@{ employeeId = $e1 }) } $hrd
Check 'rentang lebih dari 62 hari 400' ($r.Status -eq 400)
$r = Call 'POST' '/roster/generate' @{ patternId = $aman; locationId = $locId; from = '2027-03-10'; to = '2027-03-01'; employees = @(@{ employeeId = $e1 }) } $hrd
Check 'tanggal akhir sebelum awal 400' ($r.Status -eq 400)
$r = Call 'POST' '/roster/generate' @{ patternId = $aman; locationId = $locId; from = $from; to = $to; employees = @() } $hrd
Check 'daftar karyawan kosong 400' ($r.Status -eq 400)
$r = Call 'POST' '/roster/generate' @{ patternId = 999999; locationId = $locId; from = $from; to = $to; employees = @(@{ employeeId = $e1 }) } $hrd
Check 'pola tidak ada 404' ($r.Status -eq 404)
$r = Call 'POST' '/roster/generate' @{ patternId = $aman; locationId = $locId; from = $from; to = $to; employees = @(@{ employeeId = 999999 }) } $hrd
Check 'karyawan tidak ada 400' ($r.Status -eq 400)

$e = Login $nik1 'rahasia123'
$emp = $e.Body.token
$r = Call 'POST' '/roster/generate' $body $emp
Check 'EMPLOYEE generate 403' ($r.Status -eq 403)
$r = Call 'POST' '/roster/patterns' @{ nama = "Coba $sfx"; urutan = @($pagi) } $emp
Check 'EMPLOYEE membuat pola 403' ($r.Status -eq 403)
$r = Call 'GET' "/roster?from=$from&to=$to&employeeId=$e2" $null $emp
$mine = @($r.Body.data)
Check 'EMPLOYEE hanya melihat jadwal sendiri walau minta karyawan lain' ($r.Status -eq 200 -and $mine.Count -eq 12 -and @($mine | Where-Object { $_.employeeId -ne $e1 }).Count -eq 0)
$r = Call 'GET' "/roster?from=$from&to=$to"
Check 'tanpa token 401' ($r.Status -eq 401)

$r = Call 'DELETE' "/shifts/$pagiId" $null $hrd
Check 'shift yang dipakai roster tidak bisa dihapus 409' ($r.Status -eq 409)

# ---------- Bersih-bersih ----------
Write-Host 'Bersih-bersih'
$r = Call 'POST' "/employees/$e1/deactivate" $null $hrd
Check 'karyawan uji 1 dinonaktifkan' ($r.Status -eq 200)
$r = Call 'POST' "/employees/$e2/deactivate" $null $hrd
Check 'karyawan uji 2 dinonaktifkan' ($r.Status -eq 200)

Write-Host ''
$color = 'Green'
if ($script:bad -gt 0) { $color = 'Red' }
Write-Host "Selesai: $($script:ok) lulus, $($script:bad) gagal" -ForegroundColor $color
if ($script:bad -gt 0) { exit 1 }
