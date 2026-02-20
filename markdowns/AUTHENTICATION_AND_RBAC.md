# Authentication and Role-Based Access Control (RBAC) Implementation

This document describes the authentication system and role-based access control features implemented in the marketing-agent application.

## Overview

The application now features a comprehensive authentication system with three user roles, complete API call tracking, audit logging, and compliance-ready security features.

## User Roles

### 1. Viewer (Read-Only Access)
**Permissions:**
- View campaign history
- View prospect details  
- View analytics dashboards
- **Cannot** create campaigns
- **Cannot** edit or delete any data

**Use Case:** Stakeholders who need visibility into campaigns and prospects without the ability to make changes.

### 2. User (Campaign Creator)
**Permissions:**
- All Viewer permissions
- Create new marketing campaigns
- Approve prospects after ICP matching
- Generate personalized content
- Delete campaigns they created

**Use Case:** Marketing team members who execute campaigns and manage prospect outreach.

### 3. Admin (Full Access)
**Permissions:**
- All User permissions
- View API call analytics and metrics
- Access security audit logs
- Monitor system performance
- View AI prompt history for transparency

**Use Case:** System administrators and compliance officers who need full visibility and control.

## Security Features

### Role-Based Access Control (RBAC)
- Three-tier permission system enforced at the API level
- Protected routes ensure users can only access authorized endpoints
- Frontend routes automatically adjust based on user role

### API Call Tracking
- **Endpoint:** `/admin/api-calls` (Admin only)
- Tracks all API requests with:
  - Endpoint path and HTTP method
  - User role making the request
  - Response status code and time
  - IP address and user agent
  - Request body hash (SHA-256 for privacy)
  
This enables:
- Performance monitoring
- Usage analytics
- Security auditing
- Troubleshooting

### Audit Logging
- **Endpoint:** `/admin/audit-logs` (Admin only)
- Complete audit trail of all system actions:
  - Campaign creation and execution
  - Prospect approvals
  - Data deletions
  - AI prompts used (for transparency)
  - LLM model information

This ensures:
- Compliance with data protection regulations
- AI transparency and explainability
- Security incident investigation
- User action accountability

### Data Protection
- Encrypted data storage (database level)
- Request body hashing to avoid storing sensitive data in logs
- Role headers for authentication
- Secure session management

## Database Schema Changes

### New Tables

#### `api_call_logs`
Tracks every API call for monitoring and analytics:
- `id` - Unique identifier
- `endpoint` - API endpoint path
- `method` - HTTP method (GET, POST, DELETE, etc.)
- `user_role` - Role of the user making the request
- `status_code` - HTTP response status
- `response_time_ms` - Response time in milliseconds
- `ip_address` - Client IP address
- `user_agent` - Client user agent
- `request_body_hash` - SHA-256 hash of request body
- `error_message` - Error details if request failed
- `created_at` - Timestamp

#### `audit_logs`
Security and compliance audit trail:
- `id` - Unique identifier
- `action` - Action performed (e.g., 'campaign_created')
- `resource_type` - Type of resource (e.g., 'campaign', 'prospect')
- `resource_id` - ID of the affected resource
- `user_role` - Role of the user
- `ip_address` - Client IP address
- `details` - Additional context (JSON)
- `prompt_used` - AI prompt for transparency
- `llm_model` - Which LLM was used
- `created_at` - Timestamp

## Frontend Components

### Landing Page (`LandingPage.tsx`)
- Product pitch page shown on first visit
- Features grid highlighting key capabilities
- Opens login modal for authentication

### Login Modal (`LoginModal.tsx`)
- Role selection interface
- Displays permissions for each role
- Security and compliance information
- Beautiful card-based design

### Auth Context (`AuthContext.tsx`)
- Manages authentication state
- Stores user role in localStorage
- Provides login/logout functions
- Used throughout the app for access control

### Protected Routes (`ProtectedRoute.tsx`)
- Wrapper component for route protection
- Redirects unauthenticated users to landing page
- Enforces role-based access to specific routes

### Admin Analytics (`AdminAnalytics.tsx`)
- Admin-only dashboard
- Real-time API call statistics:
  - Total API calls
  - Average response time
  - Success rate
  - Error count
- Recent API calls table with details

## API Endpoints

### Updated Endpoints with RBAC

#### Campaign Execution
- **POST** `/campaigns/execute` - Create campaign (User, Admin)
- **POST** `/campaigns/approve` - Approve prospects (User, Admin)

#### History & Analytics
- **GET** `/history/executions` - View campaigns (All roles)
- **GET** `/history/executions/{id}/details` - View details (All roles)
- **DELETE** `/history/executions/{id}` - Delete campaign (User, Admin)

#### Prospects
- **GET** `/prospects/recent` - List prospects (All roles)
- **GET** `/prospects/{id}` - View prospect (All roles)
- **GET** `/history/prospects` - Prospect history (All roles)

#### Admin Only
- **GET** `/admin/api-calls` - API call analytics (Admin only)
- **GET** `/admin/audit-logs` - Security audit logs (Admin only)
- **GET** `/logs/system` - System logs (Admin only)

## Setup and Migration

### 1. Run Database Migration
```bash
python migrate_add_audit_tables.py
```

This creates the new `api_call_logs` and `audit_logs` tables.

### 2. Start the Backend
```bash
python server.py
```

The server now includes:
- API call logging middleware
- Audit trail creation helpers
- Updated role validation

### 3. Start the Frontend
```bash
cd frontend
npm install  # if first time
npm run dev
```

The app will open to the landing page where you can select your role.

## Usage

### First Time Access
1. Navigate to `http://localhost:5173`
2. You'll see the landing page with product features
3. Click "Get Started Now" or "Access Platform"
4. Select your role:
   - **Viewer** - For read-only access
   - **User** - For campaign creation
   - **Admin** - For full system access
5. Click "Continue" to enter the app

### Switching Roles
1. Click your profile icon in the top right
2. Click "Logout"
3. Select a different role from the login modal

### Admin Analytics Access
As an Admin:
1. Navigate to "Analytics" in the sidebar
2. View system metrics:
   - Total API calls
   - Average response time
   - Success rate
   - Error count
3. Review recent API call history
4. Access audit logs via `/admin/audit-logs` endpoint

## Compliance Features

### GDPR Compliance
- Audit logs track all data access
- Request hashing protects sensitive data
- User roles enforce data access policies

### SOC 2 Compliance
- Complete audit trail of all actions
- Role-based access control
- API call monitoring and analytics
- Security event logging

### AI Transparency
- All AI prompts are logged
- LLM model information tracked
- Prompt history available to admins

## Security Best Practices

1. **Role Validation:** Every API endpoint validates the user role header
2. **Request Logging:** All requests are logged with metadata
3. **Error Handling:** Errors don't expose sensitive information
4. **Session Management:** Roles stored securely in localStorage
5. **Protected Routes:** Frontend enforces role-based navigation

## Architecture

```
Frontend (React + TypeScript)
├── Landing Page (Public)
├── Login Modal (Public)
└── Protected Routes (Authenticated)
    ├── Dashboard (All roles)
    ├── Campaign (User, Admin)
    ├── History (All roles)
    ├── Prospects (All roles)
    └── Admin Analytics (Admin only)

Backend (FastAPI + Python)
├── RBAC Middleware
├── API Call Logger
├── Audit Trail System
└── Protected Endpoints
    ├── Read-only (Viewer, User, Admin)
    ├── Write operations (User, Admin)
    └── Admin operations (Admin only)

Database (SQLite/PostgreSQL)
├── Existing Tables
│   ├── prospects
│   ├── products
│   ├── engagement_history
│   ├── classifications
│   └── execution_details
└── New Tables
    ├── api_call_logs
    └── audit_logs
```

## Future Enhancements

- [ ] Add user management (create/edit/delete users)
- [ ] Implement actual authentication (passwords, OAuth, SSO)
- [ ] Add role assignment by admins
- [ ] Email notifications for compliance alerts
- [ ] Export audit logs for compliance reporting
- [ ] Real-time admin dashboard with WebSockets
- [ ] Rate limiting per role
- [ ] Advanced analytics and reporting

## Troubleshooting

### Issue: Can't access admin routes
**Solution:** Ensure you're logged in as Admin role

### Issue: API calls return 403 Forbidden
**Solution:** Check that the X-User-Role header matches your authenticated role

### Issue: New tables not created
**Solution:** Run the migration script: `python migrate_add_audit_tables.py`

### Issue: Landing page doesn't show
**Solution:** Clear browser cache and localStorage, then refresh

## Support

For questions or issues:
1. Check the audit logs for API errors
2. Review the API call analytics for performance issues
3. Contact the system administrator

---

**Version:** 1.0.0  
**Last Updated:** February 20, 2026  
**Author:** Marketing Agent Team
