# 📥 Export Feature Documentation

## Overview
Admin users can export API call logs and prompt logs in CSV or JSON format with advanced filtering options.

---

## Backend API

### Endpoint
`GET /admin/api-calls/export`

### Authentication
- **Role Required:** Admin only
- **Header:** `X-User-Role: admin`

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `"csv"` | Export format: `"csv"` or `"json"` |
| `prompts_only` | boolean | `false` | Only export logs containing prompts |
| `start_date` | string | - | ISO format start date (e.g., `2026-02-01`) |
| `end_date` | string | - | ISO format end date (e.g., `2026-02-28`) |
| `user_role` | string | - | Filter by role: `admin`, `user`, or `viewer` |
| `endpoint` | string | - | Filter by endpoint path (partial match) |
| `min_status` | integer | - | Minimum HTTP status code |
| `max_status` | integer | - | Maximum HTTP status code |

### Response

**CSV Format:**
- Content-Type: `text/csv`
- Filename: `api_logs_YYYYMMDD_HHMMSS.csv`
- Fields: `id`, `endpoint`, `method`, `user_role`, `status_code`, `response_time_ms`, `ip_address`, `prompt_preview`, `created_at`

**JSON Format:**
- Content-Type: `application/json`
- Filename: `api_logs_YYYYMMDD_HHMMSS.json`
- Structure:
```json
{
  "exported_at": "2026-02-20T12:30:45.123456",
  "total_records": 150,
  "filters": {
    "prompts_only": true,
    "start_date": "2026-02-01",
    "end_date": "2026-02-20",
    "user_role": "user",
    "endpoint": "/campaigns",
    "min_status": 200,
    "max_status": 299
  },
  "logs": [
    {
      "id": "uuid",
      "endpoint": "/campaigns/execute",
      "method": "POST",
      "user_role": "user",
      "status_code": 200,
      "response_time_ms": 1234.56,
      "ip_address": "127.0.0.1",
      "prompt_preview": "Reach out to CTOs about...",
      "created_at": "2026-02-20T07:00:00Z"
    }
  ]
}
```

---

## Frontend UI

### Export Buttons Location

#### 1. Main Header (All API Calls)
- **Export CSV** - Downloads all API call logs as CSV
- **Export JSON** - Downloads all API call logs as JSON

#### 2. Prompt Logs Section
- **Export Prompts CSV** - Downloads only logs containing prompts as CSV
- **Export Prompts JSON** - Downloads only logs containing prompts as JSON

### User Experience
- Click export button → File downloads immediately
- Filename includes timestamp: `api_logs_2026-02-20.csv`
- Button disabled during export (shows loading state)
- Auto-refresh continues in background

---

## Example Use Cases

### 1. Export All API Calls for Last Week
```
GET /admin/api-calls/export?format=csv&start_date=2026-02-13&end_date=2026-02-20
```

### 2. Export Only Prompts from User Role
```
GET /admin/api-calls/export?format=json&prompts_only=true&user_role=user
```

### 3. Export Failed Requests Only
```
GET /admin/api-calls/export?format=csv&min_status=400&max_status=599
```

### 4. Export Campaign Execution Logs
```
GET /admin/api-calls/export?format=json&endpoint=/campaigns
```

### 5. Compliance Audit Export
```
GET /admin/api-calls/export?format=json&start_date=2026-01-01&end_date=2026-12-31
```

---

## Compliance & Security Features

### Data Privacy
- Request body content is **NOT** exported (privacy-first design)
- Only request body hash is stored/exported
- Prompts are truncated to first 500 characters

### Audit Trail
- Every export action is logged
- Admin role verification required
- Timestamps in UTC with ISO format

### RBAC Enforcement
- Only Admin users can export logs
- 403 Forbidden for User/Viewer roles
- Backend validation on every request

---

## CSV Format Example

```csv
id,endpoint,method,user_role,status_code,response_time_ms,ip_address,prompt_preview,created_at
abc123,/campaigns/execute,POST,user,200,1234.56,127.0.0.1,Reach out to CTOs about...,2026-02-20T07:00:00
def456,/admin/api-calls,GET,admin,200,45.23,127.0.0.1,,2026-02-20T07:05:00
```

---

## Integration with Admin Analytics

### Auto-Refresh Behavior
- Export functionality **does not** interfere with auto-refresh
- Logs continue updating every 5 seconds during export
- Export captures current state snapshot

### Filter Compatibility
- Frontend filter state can be passed to export endpoint
- Future: Add date range picker UI for filtered exports
- Future: Add status code filter dropdowns

---

## Future Enhancements

### Planned Features
- [ ] Date range picker UI component
- [ ] Role filter dropdown in export dialog
- [ ] Endpoint filter autocomplete
- [ ] Scheduled exports (daily/weekly email)
- [ ] Export to cloud storage (S3/Azure Blob)
- [ ] Compressed exports for large datasets (.zip)
- [ ] Excel format (.xlsx) support

### Advanced Filtering
- [ ] Time range presets (Last 24h, Last 7d, Last 30d)
- [ ] Multi-select role filter
- [ ] Regex pattern matching for endpoints
- [ ] Response time range filter (slow queries)
- [ ] IP address filtering

---

## Performance Considerations

### Current Implementation
- Loads all matching logs into memory
- Suitable for datasets up to ~10,000 records
- CSV generation is memory-efficient (streaming)
- JSON generation requires full serialization

### Recommendations
- For large exports (>10k records), consider:
  - Adding pagination to export
  - Implementing streaming JSON response
  - Adding background job for large exports
  - Sending download link via email

### Database Query Optimization
- Indexed on `created_at` for date range queries
- Indexed on `user_role` for role filtering
- Consider composite index: `(created_at, user_role)` for frequent filtered exports

---

## Error Handling

### Common Errors

**Invalid Date Format:**
```json
{
  "detail": "Failed to export API logs: Invalid isoformat string"
}
```
**Solution:** Use ISO 8601 format: `YYYY-MM-DD`

**Permission Denied:**
```json
{
  "detail": "Access denied. Required role: admin"
}
```
**Solution:** Ensure `X-User-Role: admin` header is set

**Export Timeout (Large Dataset):**
```json
{
  "detail": "Request timeout"
}
```
**Solution:** Add date range filters to reduce dataset size

---

## Testing Export Feature

### Manual Testing Checklist
- [ ] Export all logs as CSV
- [ ] Export all logs as JSON
- [ ] Export prompts only as CSV
- [ ] Export prompts only as JSON
- [ ] Verify filename includes timestamp
- [ ] Verify file downloads automatically
- [ ] Test with User role (should get 403)
- [ ] Test with Viewer role (should get 403)
- [ ] Verify CSV opens in Excel/Sheets correctly
- [ ] Verify JSON is valid and formatted

### Automated Testing
```python
# Test export endpoint
def test_export_api_logs_csv():
    response = client.get(
        "/admin/api-calls/export?format=csv",
        headers={"X-User-Role": "admin"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv"
    assert "api_logs_" in response.headers["content-disposition"]

def test_export_prompts_only():
    response = client.get(
        "/admin/api-calls/export?format=json&prompts_only=true",
        headers={"X-User-Role": "admin"}
    )
    data = response.json()
    assert all(log["prompt_preview"] for log in data["logs"])
```

---

## Compliance Use Cases

### SOC 2 Audit
Export all API calls for audit period:
```
GET /admin/api-calls/export?format=json&start_date=2026-01-01&end_date=2026-12-31
```

### GDPR Data Request
Export specific user's API interactions:
```
GET /admin/api-calls/export?format=json&user_role=user&endpoint=/prospects
```

### Security Incident Investigation
Export failed authentication attempts:
```
GET /admin/api-calls/export?format=csv&min_status=401&max_status=403
```

### Performance Analysis
Export slow queries for optimization:
```
# Future: Add response_time_min filter
GET /admin/api-calls/export?format=csv&endpoint=/campaigns
```

---

**Last Updated:** February 20, 2026  
**Version:** 1.0  
**Feature Status:** ✅ Production Ready
