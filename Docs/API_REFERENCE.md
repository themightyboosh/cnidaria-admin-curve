# Cnidaria API Reference

## 🌐 Base URL
- **Production**: `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api`
- **Development**: `http://localhost:8080`

## 🔐 Authentication
All API endpoints require Firebase authentication. Include the Firebase ID token in the Authorization header:

```http
Authorization: Bearer <firebase-id-token>
```

**Note**: For production deployment, you'll need to configure Firebase credentials in your Google Cloud project. The API automatically uses the default service account credentials when deployed to Google Cloud Functions.

## 📊 Response Format
All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description",
  "message": "Human-readable error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🎯 Endpoints

### 1. Health Check
**GET** `/health`

Check API server status and health metrics.

**Production URL**: `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": "2h 15m 30s",
    "version": "1.0.0",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Test Endpoint
**GET** `/api/test`

Test API functionality and connectivity.

**Production URL**: `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/api/test`

**Response:**
```json
{
  "success": true,
  "message": "API is working!",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "method": "GET",
  "path": "/api/test"
}
```

### 3. Default Endpoint
**GET** `/`

Get general API information.

**Production URL**: `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/`

**Response:**
```json
{
  "success": true,
  "message": "New Cnidaria API endpoint",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/",
  "firebase": "ready",
  "environment": "production"
}
```

## 🔗 Production Deployment

### Live API Status
- **Status**: ✅ **ACTIVE**
- **URL**: `https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api`
- **Region**: `us-central1`
- **Runtime**: Node.js 18
- **Memory**: 512MB
- **Timeout**: 60 seconds
- **Environment**: Production

### Testing the Live API
```bash
# Health check
curl https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health

# Test endpoint
curl https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/api/test

# Default endpoint
curl https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/
```

## 🔐 Firebase Configuration

### Production Setup
The production API automatically uses Google Cloud's default service account credentials. No additional Firebase configuration is required for the API itself.

### Client Authentication
For client applications connecting to the production API:

```javascript
// Get Firebase ID token
const idToken = await firebase.auth().currentUser.getIdToken();

// Include in API requests
const response = await fetch('https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

## 📝 Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_PARAMETERS` | Request parameters are invalid |
| 401 | `UNAUTHORIZED` | Authentication required |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `ROUTE_NOT_FOUND` | Requested endpoint doesn't exist |
| 422 | `VALIDATION_ERROR` | Data validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server internal error |

## 🔄 WebSocket Events

**Note**: WebSocket support is not currently implemented in the production API. This feature will be added in future versions.

## 📊 Rate Limiting

- **Standard Endpoints**: 100 requests per minute
- **Mathematical Operations**: 50 requests per minute
- **File Uploads**: 10 requests per minute

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 🧪 Testing

### Test Endpoints
- **Health Check**: `/health` ✅
- **Test Endpoint**: `/api/test` ✅
- **Default Endpoint**: `/` ✅

### Production Test Results
```bash
# All endpoints tested and working
✅ Health check: 200 OK
✅ Test endpoint: 200 OK  
✅ Default endpoint: 200 OK
```

## 📚 SDK Examples

### JavaScript/Node.js
```javascript
const cnidariaAPI = require('cnidaria-api-client');

const client = new cnidariaAPI({
  baseURL: 'https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api',
  authToken: 'your-firebase-token'
});

// Test the API
const health = await client.health();
console.log('API Status:', health.data.status);
```

### Python
```python
import requests

client = requests.Session()
client.headers.update({
    'Authorization': 'Bearer your-firebase-token',
    'Content-Type': 'application/json'
})

# Test the API
response = client.get('https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health')
print('API Status:', response.json()['data']['status'])
```

## 🔗 Related Documentation

- [Project Overview](./PROJECT_OVERVIEW.md)
- [Development Guide](../API/DEVELOPMENT_GUIDE.md)
- [Firebase Integration](../API/FIREBASE_INTEGRATION.md)
- [Deployment Guide](../API/DEPLOYMENT_GUIDE.md)

---

*Last Updated: August 27, 2024*
*API Version: 1.0.0*
*Production Status: ✅ ACTIVE*
