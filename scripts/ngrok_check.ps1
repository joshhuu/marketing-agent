$max=12
for ($i=0; $i -lt $max; $i++) {
  try {
    $t = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -ErrorAction Stop
    if ($t.tunnels.Count -gt 0) {
      Write-Output $t.tunnels[0].public_url
      exit 0
    }
  } catch { Start-Sleep -Seconds 1 }
}
Write-Output 'NGROK_API_UNREACHABLE'
exit 1
