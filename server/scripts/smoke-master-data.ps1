# Smoke test API master data (employees, locations, shifts) terhadap server yang sedang jalan.
# Jalankan di PowerShell dari folder server, setelah `npm run dev` aktif di jendela lain:
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-master-data.ps1
# Butuh akun HRD (default: NIK 1001 / rahasia123, dibuat dengan scripts/create-user.ts).
# Data uji diberi akhiran waktu agar tidak bentrok. Shift dan lokasi uji dihapus di akhir,
# karyawan uji dinonaktifkan (karyawan memang tidak bisa dihapus), divisi "Smoke Test" tetap ada.
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
    $args2['Body'] = ($body | ConvertTo-Json -Depth 5)
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

$sfx = Get-Date -Format 'MMddHHmmss'
Write-Host "Smoke test master data ($sfx)" -ForegroundColor Cyan

# ---------- Login HRD ----------
$l = Login $Nik $Password
if ($l.Status -ne 200) { Write-Host "Login HRD gagal (status $($l.Status)). Cek NIK/password dan server." -ForegroundColor Red; exit 1 }
$hrd = $l.Body.token
Check 'login HRD' ($l.Body.user.role -eq 'HRD' -or $l.Body.user.role -eq 'ADMIN')

# ---------- Shifts ----------
Write-Host 'Shifts'
$r = Call 'GET' '/shifts' $null $hrd
Check 'GET /shifts 200' ($r.Status -eq 200)
$shiftName = "Smoke Malam $sfx"
$r = Call 'POST' '/shifts' @{ nama = $shiftName; jamMulai = '22:00'; jamSelesai = '06:00' } $hrd
Check 'POST /shifts 201' ($r.Status -eq 201)
Check 'shift malam lintasHari = true' ($r.Body.data.lintasHari -eq $true)
Check 'toleransi default 5' ($r.Body.data.toleransiMenit -eq 5)
Check 'jam kembali sebagai HH:mm' ($r.Body.data.jamMulai -eq '22:00' -and $r.Body.data.jamSelesai -eq '06:00')
$shiftId = $r.Body.data.id
$r = Call 'POST' '/shifts' @{ nama = $shiftName; jamMulai = '08:00'; jamSelesai = '16:00' } $hrd
Check 'nama shift kembar 409' ($r.Status -eq 409)
$r = Call 'PATCH' "/shifts/$shiftId" @{ toleransiMenit = 10 } $hrd
Check 'PATCH toleransi 200' ($r.Status -eq 200 -and $r.Body.data.toleransiMenit -eq 10 -and $r.Body.data.jamMulai -eq '22:00')
$r = Call 'PATCH' "/shifts/$shiftId" @{ jamSelesai = '22:00' } $hrd
Check 'jam mulai = jam selesai 400' ($r.Status -eq 400)
$r = Call 'POST' '/shifts' @{ nama = 'X'; jamMulai = '25:00'; jamSelesai = '06:00' } $hrd
Check 'jam tidak valid 400 VALIDATION_ERROR' ($r.Status -eq 400 -and $r.Body.error.code -eq 'VALIDATION_ERROR')

# ---------- Locations ----------
Write-Host 'Locations'
$locName = "Smoke Lokasi $sfx"
$r = Call 'POST' '/locations' @{ nama = $locName; lat = -6.3; lng = 107.15 } $hrd
Check 'POST /locations 201' ($r.Status -eq 201)
Check 'radius default 100' ($r.Body.data.radiusM -eq 100)
Check 'lat/lng berupa angka' ((($r.Body.data.lat -is [double]) -or ($r.Body.data.lat -is [decimal])) -and ($r.Body.data.lat -eq -6.3))
$locId = $r.Body.data.id
$r = Call 'PATCH' "/locations/$locId" @{ radiusM = 150 } $hrd
Check 'PATCH radius, koordinat tetap' ($r.Status -eq 200 -and $r.Body.data.radiusM -eq 150 -and $r.Body.data.lat -eq -6.3)
$r = Call 'POST' '/locations' @{ nama = 'Salah'; lat = 91; lng = 0 } $hrd
Check 'latitude di luar batas 400' ($r.Status -eq 400)

# ---------- Divisi ----------
Write-Host 'Divisi'
$r = Call 'GET' '/employees/departments' $null $hrd
Check 'GET /employees/departments 200' ($r.Status -eq 200)
$dept = $r.Body.data | Where-Object { $_.nama -eq 'Smoke Test' } | Select-Object -First 1
if ($null -eq $dept) {
  $r = Call 'POST' '/employees/departments' @{ nama = 'Smoke Test' } $hrd
  Check 'POST divisi 201' ($r.Status -eq 201)
  $deptId = $r.Body.data.id
} else {
  $deptId = $dept.id
  Write-Host '  (divisi Smoke Test sudah ada, dipakai ulang)'
}

# ---------- Employees ----------
Write-Host 'Employees'
$empNik = "SMK$sfx"
$r = Call 'POST' '/employees' @{ nik = $empNik; nama = 'Karyawan Smoke'; departmentId = $deptId; tanggalMasuk = '2026-10-01'; password = 'rahasia123' } $hrd
Check 'POST /employees 201' ($r.Status -eq 201)
Check 'role default EMPLOYEE, aktif' ($r.Body.data.role -eq 'EMPLOYEE' -and $r.Body.data.aktif -eq $true)
Check 'tanggalMasuk tidak bergeser' ($r.Body.data.tanggalMasuk -eq '2026-10-01')
$empId = $r.Body.data.id
$r = Call 'POST' '/employees' @{ nik = $empNik; nama = 'Kembar'; departmentId = $deptId; tanggalMasuk = '2026-10-01'; password = 'rahasia123' } $hrd
Check 'NIK kembar 409' ($r.Status -eq 409)
$r = Call 'POST' '/employees' @{ nik = "ADM$sfx"; nama = 'Coba Admin'; departmentId = $deptId; tanggalMasuk = '2026-10-01'; password = 'rahasia123'; role = 'ADMIN' } $hrd
if ($l.Body.user.role -eq 'HRD') { Check 'HRD membuat ADMIN ditolak 403' ($r.Status -eq 403) }
$r = Call 'POST' '/employees' @{ nik = "BAD$sfx"; nama = 'Pendek'; departmentId = $deptId; tanggalMasuk = '2026-10-01'; password = 'pendek' } $hrd
Check 'password pendek 400' ($r.Status -eq 400)

$e = Login $empNik 'rahasia123'
Check 'karyawan baru bisa login' ($e.Status -eq 200)
$emp = $e.Body.token

$r = Call 'GET' "/employees?q=$empNik" $null $hrd
Check 'pencarian NIK: total 1' ($r.Status -eq 200 -and $r.Body.total -eq 1)
$r = Call 'GET' '/employees?limit=2&page=1' $null $hrd
Check 'paginasi limit=2' ($r.Status -eq 200 -and @($r.Body.data).Count -le 2)
$r = Call 'GET' "/employees/$empId" $null $hrd
Check 'GET /employees/:id 200' ($r.Status -eq 200 -and $r.Body.data.nik -eq $empNik)
$r = Call 'GET' '/employees/abc' $null $hrd
Check 'id bukan angka 400' ($r.Status -eq 400)
$r = Call 'GET' '/employees/999999' $null $hrd
Check 'id tidak ada 404' ($r.Status -eq 404)

$r = Call 'PATCH' "/employees/$empId" @{ nama = 'Karyawan Smoke Baru' } $hrd
Check 'PATCH nama 200' ($r.Status -eq 200 -and $r.Body.data.nama -eq 'Karyawan Smoke Baru')
$r = Call 'PATCH' "/employees/$empId" @{ atasanId = $empId } $hrd
Check 'atasan diri sendiri 400' ($r.Status -eq 400)

# ---------- RBAC ----------
Write-Host 'RBAC'
$r = Call 'GET' '/employees' $null $emp
Check 'EMPLOYEE melihat daftar karyawan 403' ($r.Status -eq 403)
$r = Call 'GET' '/shifts' $null $emp
Check 'EMPLOYEE melihat shift 200' ($r.Status -eq 200)
$r = Call 'POST' '/shifts' @{ nama = "Nakal $sfx"; jamMulai = '01:00'; jamSelesai = '02:00' } $emp
Check 'EMPLOYEE membuat shift 403' ($r.Status -eq 403)
$r = Call 'GET' '/shifts' $null ''
Check 'tanpa token 401' ($r.Status -eq 401)

# ---------- Password dan status ----------
Write-Host 'Password dan status'
$r = Call 'POST' "/employees/$empId/reset-password" @{ password = 'passwordBaru1' } $hrd
Check 'reset password 204' ($r.Status -eq 204)
$x = Login $empNik 'rahasia123'
Check 'password lama ditolak 401' ($x.Status -eq 401)
$x = Login $empNik 'passwordBaru1'
Check 'password baru berhasil' ($x.Status -eq 200)
$r = Call 'POST' "/employees/$empId/deactivate" $null $hrd
Check 'nonaktifkan 200, aktif = false' ($r.Status -eq 200 -and $r.Body.data.aktif -eq $false)
$x = Login $empNik 'passwordBaru1'
Check 'akun nonaktif tidak bisa login (403)' ($x.Status -eq 403)
$r = Call 'GET' "/employees?q=$empNik" $null $hrd
Check 'daftar default menyembunyikan yang nonaktif' ($r.Body.total -eq 0)
$r = Call 'GET' "/employees?q=$empNik&aktif=all" $null $hrd
Check 'aktif=all menampilkan semua' ($r.Body.total -eq 1)
$r = Call 'POST' "/employees/$empId/activate" $null $hrd
Check 'aktifkan kembali 200' ($r.Status -eq 200 -and $r.Body.data.aktif -eq $true)
$me = Call 'GET' '/auth/me' $null $hrd
$r = Call 'POST' "/employees/$($me.Body.user.employeeId)/deactivate" $null $hrd
Check 'menonaktifkan diri sendiri 403' ($r.Status -eq 403)

# ---------- Bersih-bersih ----------
Write-Host 'Bersih-bersih'
$r = Call 'DELETE' "/shifts/$shiftId" $null $hrd
Check 'hapus shift uji 204' ($r.Status -eq 204)
$r = Call 'DELETE' "/locations/$locId" $null $hrd
Check 'hapus lokasi uji 204' ($r.Status -eq 204)
$r = Call 'GET' "/shifts/$shiftId" $null $hrd
Check 'shift yang dihapus 404' ($r.Status -eq 404)
$r = Call 'POST' "/employees/$empId/deactivate" $null $hrd
Check 'karyawan uji dinonaktifkan' ($r.Status -eq 200)

Write-Host ''
$color = 'Green'
if ($script:bad -gt 0) { $color = 'Red' }
Write-Host "Selesai: $($script:ok) lulus, $($script:bad) gagal" -ForegroundColor $color
if ($script:bad -gt 0) { exit 1 }
