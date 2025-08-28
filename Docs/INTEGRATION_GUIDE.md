# Cnidaria API Integration Guide

## 🎯 Overview
This guide provides comprehensive instructions for integrating the Cnidaria API with various platforms, game engines, and development tools. The API is designed to be platform-agnostic and provides RESTful endpoints for mathematical curve processing.

## 🚀 Quick Start Integration

### 1. Production API
The Cnidaria API is now live and available at:
```
https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api
```

### 2. Test Connection
```bash
# Test the live API
curl https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health
```

Expected response:
```json
{
  "success": true,
  "message": "New Cnidaria API - Firebase Ready with Mathematical Processing!",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "healthy",
  "firebase": "initialized",
  "environment": "production"
}
```

## 🔐 Authentication Setup

### Firebase Configuration
1. **Get Firebase Project ID** from your Firebase console
2. **Download Service Account Key** (JSON file)
3. **Set Environment Variables**:

```bash
# Copy environment template
cp env.example .env

# Edit .env file
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json
```

### Client Authentication
```javascript
// Get Firebase ID token
const idToken = await firebase.auth().currentUser.getIdToken();

// Include in API requests to production
const response = await fetch('https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

## 🎮 Unity Integration

### 1. Unity Package Setup
Create a Unity package with the following structure:
```
Assets/
├── Scripts/
│   ├── CnidariaAPI/
│   │   ├── CnidariaAPIClient.cs
│   │   ├── CurveData.cs
│   │   └── CurveRenderer.cs
│   └── Examples/
│       └── CurveExample.cs
├── Prefabs/
│   └── CurveRenderer.prefab
└── Scenes/
    └── CurveDemo.unity
```

### 2. API Client Script
```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Text;

[System.Serializable]
public class CurveRequest
{
    public Vector2[] controlPoints;
    public int segments;
    public string name;
    public string description;
}

[System.Serializable]
public class CurveResponse
{
    public bool success;
    public CurveData data;
    public string message;
}

[System.Serializable]
public class CurveData
{
    public string curveId;
    public string type;
    public Vector2[] points;
    public CurveMetadata metadata;
}

public class CnidariaAPIClient : MonoBehaviour
{
    [Header("API Configuration")]
    public string baseURL = "https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api";
    public string authToken = "";
    
    [Header("Curve Settings")]
    public int defaultSegments = 100;
    
    public IEnumerator TestAPI(System.Action<bool> onComplete)
    {
        using (UnityWebRequest www = UnityWebRequest.Get($"{baseURL}/health"))
        {
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("API connection successful!");
                onComplete?.Invoke(true);
            }
            else
            {
                Debug.LogError($"API connection failed: {www.error}");
                onComplete?.Invoke(false);
            }
        }
    }
    
    public IEnumerator GenerateBezierCurve(CurveRequest request, System.Action<CurveData> onSuccess, System.Action<string> onError)
    {
        string json = JsonUtility.ToJson(request);
        byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
        
        using (UnityWebRequest www = new UnityWebRequest($"{baseURL}/api/curves/bezier", "POST"))
        {
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");
            www.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                CurveResponse response = JsonUtility.FromJson<CurveResponse>(www.downloadHandler.text);
                if (response.success)
                {
                    onSuccess?.Invoke(response.data);
                }
                else
                {
                    onError?.Invoke(response.message);
                }
            }
            else
            {
                onError?.Invoke(www.error);
            }
        }
    }
    
    public IEnumerator GetCurve(string curveId, System.Action<CurveData> onSuccess, System.Action<string> onError)
    {
        using (UnityWebRequest www = UnityWebRequest.Get($"{baseURL}/api/curves/{curveId}"))
        {
            www.SetRequestHeader("Authorization", $"Bearer {authToken}");
            
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                CurveResponse response = JsonUtility.FromJson<CurveResponse>(www.downloadHandler.text);
                if (response.success)
                {
                    onSuccess?.Invoke(response.data);
                }
                else
                {
                    onError?.Invoke(response.message);
                }
            }
            else
            {
                onError?.Invoke(www.error);
            }
        }
    }
}
```

### 3. Example Usage
```csharp
public class CurveExample : MonoBehaviour
{
    public CnidariaAPIClient apiClient;
    
    void Start()
    {
        // Test API connection first
        StartCoroutine(apiClient.TestAPI((success) => {
            if (success)
            {
                Debug.Log("Ready to use Cnidaria API!");
                // Now you can make other API calls
            }
            else
            {
                Debug.LogError("Failed to connect to Cnidaria API");
            }
        }));
    }
}
```

## 🌐 Web Integration

### 1. JavaScript Client
```javascript
class CnidariaAPIClient {
    constructor(authToken) {
        this.baseURL = 'https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api';
        this.authToken = authToken;
    }
    
    async testConnection() {
        const response = await fetch(`${this.baseURL}/health`, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
            }
        });
        
        return await response.json();
    }
    
    async generateBezierCurve(controlPoints, segments, metadata = {}) {
        const response = await fetch(`${this.baseURL}/api/curves/bezier`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({
                controlPoints: controlPoints.map(p => ({ x: p.x, y: p.y })),
                segments,
                metadata
            })
        });
        
        return await response.json();
    }
    
    async getCurve(curveId) {
        const response = await fetch(`${this.baseURL}/api/curves/${curveId}`, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        });
        
        return await response.json();
    }
    
    async listCurves(page = 1, limit = 20) {
        const response = await fetch(
            `${this.baseURL}/api/curves?page=${page}&limit=${limit}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            }
        );
        
        return await response.json();
    }
}

// Usage example
const client = new CnidariaAPIClient('your-firebase-token');

// Test connection first
client.testConnection().then(result => {
    if (result.success) {
        console.log('✅ Connected to Cnidaria API!');
        console.log('Status:', result.data.status);
    } else {
        console.error('❌ Failed to connect to API');
    }
}).catch(error => {
    console.error('Error:', error);
});
```

### 2. HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>Cnidaria Curve Demo</title>
    <style>
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .status {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .status.connected {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .status.disconnected {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .controls {
            margin-bottom: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .control-group {
            margin-bottom: 15px;
        }
        
        .control-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        .control-group input, .control-group button {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .control-group button {
            background: #007bff;
            color: white;
            border: none;
            cursor: pointer;
        }
        
        .control-group button:hover {
            background: #0056b3;
        }
        
        #curveCanvas {
            border: 1px solid #ddd;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Cnidaria Curve Generator</h1>
        
        <div id="status" class="status disconnected">
            Checking API connection...
        </div>
        
        <div class="controls">
            <div class="control-group">
                <label>Firebase Auth Token:</label>
                <input type="text" id="authToken" placeholder="Enter your Firebase ID token">
            </div>
            
            <div class="control-group">
                <button onclick="testConnection()">Test Connection</button>
                <button onclick="clearCanvas()">Clear Canvas</button>
            </div>
        </div>
        
        <canvas id="curveCanvas" width="800" height="600"></canvas>
    </div>
    
    <script>
        let client = null;
        
        function testConnection() {
            const token = document.getElementById('authToken').value;
            if (!token) {
                alert('Please enter a Firebase auth token');
                return;
            }
            
            client = new CnidariaAPIClient(token);
            
            client.testConnection().then(result => {
                const statusDiv = document.getElementById('status');
                if (result.success) {
                    statusDiv.className = 'status connected';
                    statusDiv.textContent = `✅ Connected to Cnidaria API! Status: ${result.data.status}`;
                } else {
                    statusDiv.className = 'status disconnected';
                    statusDiv.textContent = '❌ Failed to connect to API';
                }
            }).catch(error => {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status disconnected';
                statusDiv.textContent = `❌ Connection error: ${error.message}`;
            });
        }
        
        function clearCanvas() {
            const canvas = document.getElementById('curveCanvas');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Test connection on page load
        window.addEventListener('load', () => {
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = 'Ready to connect to Cnidaria API';
        });
    </script>
</body>
</html>
```

## 🐍 Python Integration

### 1. Python Client
```python
import requests
import json
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

@dataclass
class CurveRequest:
    control_points: List[Point]
    segments: int
    metadata: Dict[str, str]

@dataclass
class CurveData:
    curve_id: str
    type: str
    points: List[Point]
    metadata: Dict[str, str]

class CnidariaAPIClient:
    def __init__(self, auth_token: str):
        self.base_url = "https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api"
        self.auth_token = auth_token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        })
    
    def test_connection(self) -> Dict:
        """Test connection to the API."""
        url = f"{self.base_url}/health"
        response = self.session.get(url)
        response.raise_for_status()
        
        return response.json()
    
    def generate_bezier_curve(self, request: CurveRequest) -> Dict:
        """Generate a Bezier curve using the API."""
        url = f"{self.base_url}/api/curves/bezier"
        
        # Convert request to API format
        payload = {
            "controlPoints": [{"x": p.x, "y": p.y} for p in request.control_points],
            "segments": request.segments,
            "metadata": request.metadata
        }
        
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        return response.json()
    
    def get_curve(self, curve_id: str) -> Dict:
        """Retrieve a curve by ID."""
        url = f"{self.base_url}/api/curves/{curve_id}"
        response = self.session.get(url)
        response.raise_for_status()
        
        return response.json()
    
    def list_curves(self, page: int = 1, limit: int = 20) -> Dict:
        """List all curves with pagination."""
        url = f"{self.base_url}/api/curves"
        params = {"page": page, "limit": limit}
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def delete_curve(self, curve_id: str) -> Dict:
        """Delete a curve by ID."""
        url = f"{self.base_url}/api/curves/{curve_id}"
        response = self.session.delete(url)
        response.raise_for_status()
        
        return response.json()

# Usage example
def main():
    # Initialize client
    client = CnidariaAPIClient("your-firebase-token")
    
    try:
        # Test connection first
        result = client.test_connection()
        
        if result.get("success"):
            print("✅ Connected to Cnidaria API!")
            print(f"Status: {result['data']['status']}")
            print(f"Environment: {result['data']['environment']}")
        else:
            print(f"❌ Failed to connect: {result.get('message', 'Unknown error')}")
            return
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        return
    except Exception as e:
        print(f"❌ Error: {e}")
        return

if __name__ == "__main__":
    main()
```

## 🔧 Testing Integration

### 1. Connection Test
```python
def test_live_api():
    """Test against live API server."""
    client = CnidariaAPIClient(
        auth_token="your-firebase-token"
    )
    
    # Test health endpoint
    try:
        result = client.test_connection()
        assert result["success"]
        print("✅ Health check passed")
        print(f"Status: {result['data']['status']}")
        return True
        
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

if __name__ == "__main__":
    success = test_live_api()
    if success:
        print("\n🎉 API connection successful!")
    else:
        print("\n💥 API connection failed!")
```

## 📱 Mobile Integration

### React Native
```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const CnidariaAPIConnector = () => {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState('Disconnected');
    
    const testConnection = async () => {
        try {
            const response = await fetch('https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api/health', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });
            const data = await response.json();
            
            if (data.success) {
                setConnected(true);
                setStatus(data.data.status);
            } else {
                setConnected(false);
                setStatus('Failed');
            }
        } catch (error) {
            setConnected(false);
            setStatus('Error');
            console.error('Connection error:', error);
        }
    };
    
    return (
        <View style={styles.container}>
            <View style={[styles.statusIndicator, connected ? styles.connected : styles.disconnected]}>
                <Text style={styles.statusText}>
                    {connected ? '✅ Connected' : '❌ Disconnected'}
                </Text>
                <Text style={styles.statusText}>Status: {status}</Text>
            </View>
            
            <TouchableOpacity style={styles.button} onPress={testConnection}>
                <Text style={styles.buttonText}>Test Connection</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    statusIndicator: {
        padding: 20,
        borderRadius: 8,
        marginBottom: 20,
        alignItems: 'center',
    },
    connected: {
        backgroundColor: '#d4edda',
        borderColor: '#c3e6cb',
        borderWidth: 1,
    },
    disconnected: {
        backgroundColor: '#f8d7da',
        borderColor: '#f5c6cb',
        borderWidth: 1,
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    button: {
        backgroundColor: '#007bff',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default CnidariaAPIConnector;
```

## 🔍 Debugging and Troubleshooting

### Common Issues

#### 1. CORS Errors
**Problem**: Browser blocks requests due to CORS policy
**Solution**: The production API has CORS enabled for all origins

#### 2. Authentication Errors
**Problem**: 401 Unauthorized responses
**Solution**: Verify Firebase token is valid and properly formatted

```javascript
// Check token format
console.log('Token:', authToken.substring(0, 20) + '...');

// Verify token with Firebase
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        user.getIdToken().then(token => {
            console.log('Valid token:', token.substring(0, 20) + '...');
        });
    }
});
```

#### 3. Network Timeouts
**Problem**: Requests hang or timeout
**Solution**: Add timeout configuration and error handling

```javascript
// Add timeout to fetch requests
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
    const response = await fetch(url, {
        signal: controller.signal,
        // ... other options
    });
    clearTimeout(timeoutId);
    // Process response
} catch (error) {
    if (error.name === 'AbortError') {
        console.log('Request timed out');
    } else {
        console.error('Request failed:', error);
    }
}
```

### Debug Tools

#### 1. API Logging
```javascript
// Enable detailed logging in your API client
class CnidariaAPIClient {
    constructor(authToken, debug = false) {
        this.debug = debug;
        this.baseURL = 'https://us-central1-zone-eaters.cloudfunctions.net/cnidaria-api';
        this.authToken = authToken;
    }
    
    async makeRequest(url, options) {
        if (this.debug) {
            console.log('Request:', { url, options });
        }
        
        const response = await fetch(url, options);
        
        if (this.debug) {
            console.log('Response:', {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: await response.clone().text()
            });
        }
        
        return response;
    }
}
```

#### 2. Network Inspector
Use browser DevTools Network tab to:
- Monitor API requests and responses
- Check request headers and payloads
- Analyze response times and errors
- Verify authentication tokens

## 📚 Additional Resources

### Documentation
- [API Reference](./API_REFERENCE.md)
- [Project Overview](./PROJECT_OVERVIEW.md)
- [Development Guide](../API/DEVELOPMENT_GUIDE.md)

### Examples
- [Unity Demo Project](../Unity/)
- [Web Demo](../Tests/API/)
- [Python Examples](../Tests/API/)

### Support
- [GitHub Issues](https://github.com/themightyboosh/cnidaria-api/issues)
- [Discussions](https://github.com/themightyboosh/cnidaria-api/discussions)
- [Wiki](https://github.com/themightyboosh/cnidaria-api/wiki)

---

*Last Updated: August 27, 2024*
*Integration Guide Version: 1.0.0*
*Production API: ✅ ACTIVE*
