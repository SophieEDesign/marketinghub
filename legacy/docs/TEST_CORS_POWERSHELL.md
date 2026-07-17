# Test CORS Headers - PowerShell Commands

## Option 1: Use curl.exe (if curl is installed)

```powershell
curl.exe -i -X OPTIONS "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" `
  -H "Origin: https://marketing.petersandmay.com" `
  -H "Access-Control-Request-Method: GET"
```

## Option 2: Use PowerShell's Invoke-WebRequest

```powershell
$response = Invoke-WebRequest -Uri "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" `
  -Method OPTIONS `
  -Headers @{
    "Origin" = "https://marketing.petersandmay.com"
    "Access-Control-Request-Method" = "GET"
  }

# Display all headers
$response.Headers

# Display specific CORS headers
Write-Host "Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])"
Write-Host "Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])"
Write-Host "Access-Control-Allow-Credentials: $($response.Headers['Access-Control-Allow-Credentials'])"
```

## Option 3: Simple PowerShell one-liner

```powershell
(Invoke-WebRequest -Uri "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" -Method OPTIONS -Headers @{"Origin"="https://marketing.petersandmay.com";"Access-Control-Request-Method"="GET"}).Headers
```

## What to Look For

After running any of the above commands, look for:
- **`Access-Control-Allow-Origin: *`** = PostgREST is NOT reading the role config ❌
- **`Access-Control-Allow-Origin: https://marketing.petersandmay.com`** = PostgREST IS reading the config ✅

## Quick Test Command (Copy & Paste)

Run this in PowerShell:

```powershell
$headers = @{
    "Origin" = "https://marketing.petersandmay.com"
    "Access-Control-Request-Method" = "GET"
}
$response = Invoke-WebRequest -Uri "https://hwtycgvclhckglmuwnmw.supabase.co/rest/v1/?select=1" -Method OPTIONS -Headers $headers
Write-Host "`n=== CORS Headers ===" -ForegroundColor Cyan
Write-Host "Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Yellow
Write-Host "Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Yellow
Write-Host "Access-Control-Allow-Credentials: $($response.Headers['Access-Control-Allow-Credentials'])" -ForegroundColor Yellow
Write-Host "`nAll Response Headers:" -ForegroundColor Cyan
$response.Headers | Format-List
```
