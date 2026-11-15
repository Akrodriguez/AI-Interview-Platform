# Setting Up Ollama on Free Google Colab with Persistent Models and Authenticated ngrok CLI Tunnel

This guide walks you through running Ollama on Google Colab's free T4 GPU, persisting downloaded models in Google Drive, and securely exposing the Ollama API to your AI Interview Platform using the official ngrok CLI and Traffic Policy engine.

---

## Architecture Overview

```
[Candidate / Windows Backend]
       │
       ▼  HTTPS Request (Authorization: Basic <base64>, ngrok-skip-browser-warning: true)
[ngrok Edge: https://your-reserved-domain.ngrok-free.dev]
       │
       ├─► Traffic Policy (basic-auth): Rejects unauthenticated requests with HTTP 401
       │
       ├─► Traffic Policy (add-headers): Rewrites Host header to "localhost:11434"
       │
       ▼  Forwarded to local container port 11434
[Google Colab T4 Container]
       │
       ├─► Ollama Daemon (OLLAMA_ORIGINS="*", OLLAMA_HOST="0.0.0.0:11434")
       │
       └─► Google Drive Persistence: /content/drive/MyDrive/ollama_models (No re-downloads)
```

If the Colab runtime disconnects or is stopped, the AI Interview Platform backend automatically cascades down the fallback chain: **Ollama → Gemini → OpenRouter**.

---

## Prerequisites

1. A Google account to use [Google Colab](https://colab.research.google.com/) and Google Drive.
2. A free [ngrok account](https://dashboard.ngrok.com/signup).
3. A free **static reserved domain** on ngrok (e.g., `your-domain.ngrok-free.dev` or `your-domain.ngrok-free.app`), claimable on the [ngrok Domains Dashboard](https://dashboard.ngrok.com/cloud-edge/domains).
4. Your ngrok Authtoken from the [ngrok Authtoken Dashboard](https://dashboard.ngrok.com/get-started/your-authtoken).

---

## Step 1: Create a Colab Notebook with T4 GPU

1. Go to [Google Colab](https://colab.research.google.com/) and create a **New Notebook**.
2. Click **Runtime** → **Change runtime type**.
3. Select **T4 GPU** under Hardware accelerator and click **Save**.

---

## Step 2: Install Ollama & ngrok CLI (v3+)

In the first code cell, install Ollama and the official ngrok CLI:

```bash
# 1. Install Ollama
!curl -fsSL https://ollama.com/install.sh | sh

# 2. Install official ngrok Linux CLI (v3+)
!curl -sSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz -C /usr/local/bin
!ngrok version
```

---

## Step 3: Configure Colab Secrets

Store your credentials securely in Google Colab's built-in Secrets manager instead of hardcoding them in code cells:

1. Click the **Key icon** (Secrets) on the left sidebar in Colab.
2. Add the following two secrets:
   - **`NGROK_AUTH_TOKEN`**: Your ngrok authtoken from the ngrok dashboard.
   - **`OLLAMA_TUNNEL_AUTH`**: Tunnel credentials in `username:password` format (e.g., `interview_admin:YourStrongPassword123`).
     > [!IMPORTANT]
     > ngrok requires the password to be at least **8 characters** long.
3. Toggle **Notebook access** to **ON** for both secrets so Python scripts can read them via `google.colab.userdata`.

---

## Step 4: The Complete Colab Startup Cell

Run this unified cell to mount Google Drive, start Ollama with persistent storage, generate the ngrok Traffic Policy, launch the authenticated tunnel, and run self-tests:

```python
# ==============================================================================
# Google Colab Startup Cell: Ollama + Google Drive Storage + ngrok Traffic Policy
# ==============================================================================
import os
import time
import base64
import yaml
import subprocess
import requests
from google.colab import drive, userdata

# 1. Mount Google Drive for persistent model storage
if not os.path.exists('/content/drive/MyDrive'):
    drive.mount('/content/drive')

DRIVE_MODEL_DIR = '/content/drive/MyDrive/ollama_models'
os.makedirs(DRIVE_MODEL_DIR, exist_ok=True)

# 2. Configure Ollama environment
os.environ["OLLAMA_MODELS"] = DRIVE_MODEL_DIR
os.environ["OLLAMA_HOST"] = "0.0.0.0:11434"
os.environ["OLLAMA_ORIGINS"] = "*"

# 3. Clean up any existing instances
subprocess.run(["pkill", "-9", "-f", "ollama serve"], stderr=subprocess.DEVNULL)
subprocess.run(["pkill", "-9", "-f", "ngrok"], stderr=subprocess.DEVNULL)
time.sleep(2)

# 4. Start Ollama in the background
print("🚀 Starting Ollama server with Drive model persistence...")
ollama_log = open("/content/ollama.log", "w")
subprocess.Popen(["ollama", "serve"], stdout=ollama_log, stderr=ollama_log)

# Wait for local Ollama daemon to become ready
ollama_ready = False
for _ in range(15):
    try:
        r = requests.get("http://127.0.0.1:11434/api/tags", timeout=2)
        if r.status_code == 200:
            ollama_ready = True
            break
    except Exception:
        time.sleep(1)

if not ollama_ready:
    raise RuntimeError("❌ Ollama server failed to start. Check /content/ollama.log")

print("✅ Local Ollama is up and running on port 11434.")

# 5. Check model availability in Drive (pulls only if missing)
models_resp = requests.get("http://127.0.0.1:11434/api/tags").json()
model_names = [m.get("name") for m in models_resp.get("models", [])]
print(f"📦 Models available in Drive: {model_names}")

if not any("llama3.2:1b" in m for m in model_names):
    print("⏳ llama3.2:1b not found in Drive. Downloading model (~1.3 GB)...")
    subprocess.run(["ollama", "pull", "llama3.2:1b"], check=True)
    print("✅ Model downloaded and saved to Google Drive.")
else:
    print("⚡ llama3.2:1b loaded directly from Google Drive cache (0 MB download).")

# 6. Retrieve credentials from Colab Secrets
ngrok_token = userdata.get('NGROK_AUTH_TOKEN').strip()
tunnel_auth = userdata.get('OLLAMA_TUNNEL_AUTH').strip() # format: "username:password"

if not ngrok_token or not tunnel_auth:
    raise ValueError("❌ Missing NGROK_AUTH_TOKEN or OLLAMA_TUNNEL_AUTH in Colab Secrets!")

# Configure ngrok authtoken
subprocess.run(["ngrok", "config", "add-authtoken", ngrok_token], check=True)

# 7. Generate Traffic Policy YAML with basic-auth and Host header rewrite
policy_config = {
    "on_http_request": [
        {
            "actions": [
                {
                    "type": "basic-auth",
                    "config": {
                        "credentials": [tunnel_auth]
                    }
                },
                {
                    "type": "add-headers",
                    "config": {
                        "headers": {
                            "Host": "localhost:11434"
                        }
                    }
                }
            ]
        }
    ]
}

POLICY_PATH = "/content/policy.yml"
with open(POLICY_PATH, "w") as f:
    yaml.dump(policy_config, f, default_flow_style=False)

# 8. Start ngrok CLI with reserved domain and Host header rewrite
# REPLACE with your actual reserved domain:
RESERVED_DOMAIN = "your-reserved-domain.ngrok-free.dev"

print(f"🌐 Launching ngrok tunnel for {RESERVED_DOMAIN}...")
ngrok_cmd = [
    "ngrok", "http", "11434",
    f"--url=https://{RESERVED_DOMAIN}",
    "--host-header=localhost:11434",
    f"--traffic-policy-file={POLICY_PATH}",
    "--log=/content/ngrok.log",
    "--log-format=term"
]

subprocess.Popen(ngrok_cmd)
time.sleep(4)

# 9. Verify remote authenticated endpoint from Colab
auth_b64 = base64.b64encode(tunnel_auth.encode("utf-8")).decode("utf-8")
test_headers = {
    "Authorization": f"Basic {auth_b64}",
    "ngrok-skip-browser-warning": "true"
}

public_url = f"https://{RESERVED_DOMAIN}/api/tags"
try:
    test_res = requests.get(public_url, headers=test_headers, timeout=10)
    print("\n" + "=" * 60)
    print(f"📡 Remote Authenticated Probe: HTTP {test_res.status_code}")
    if test_res.status_code == 200:
        print("🎉 SUCCESS! ngrok authentication and Ollama Host validation PASSED.")
        print("=" * 60)
        print("\n🔑 Configure this in your Windows backend server/.env:")
        print("AI_PROVIDER=ollama")
        print(f"OLLAMA_BASE_URL=https://{RESERVED_DOMAIN}")
        print("OLLAMA_MODEL=llama3.2:1b")
        print(f"OLLAMA_AUTH_TOKEN=Basic {auth_b64}")
        print("OLLAMA_TIMEOUT_MS=300000")
    else:
        print(f"⚠️ Unexpected status: {test_res.status_code} - {test_res.text[:200]}")
except Exception as e:
    print(f"❌ Verification failed to reach public endpoint: {e}")
```

---

## Step 5: Why the Host Header Rewrite is Required (HTTP 403 Resolution)

In previous iterations, authenticated requests yielded an **HTTP 403 Forbidden** error despite valid basic-auth credentials.

### Root Cause
Ollama contains built-in security middleware to defend against **DNS rebinding attacks** (CVE-2024-28224). When requests pass through a public proxy or tunnel, the incoming `Host` header contains the external domain (e.g. `your-domain.ngrok-free.dev`). Ollama inspects this header and immediately rejects requests whose `Host` does not match `localhost`, `127.0.0.1`, or an allowed origin, returning a blank `403 Forbidden`.

### Solution
The setup applies a two-layer host rewrite:
1. **ngrok CLI argument**: `--host-header=localhost:11434`
2. **ngrok Traffic Policy action**:
   ```yaml
   - type: add-headers
     config:
       headers:
         Host: "localhost:11434"
   ```

With this rewrite in place, ngrok validates the `basic-auth` credentials at the edge, rewrites the `Host` header to `localhost:11434`, and passes the request to Ollama, returning **HTTP 200 OK**.

---

## Step 6: Configure Your AI Interview Platform `.env`

In your backend `server/.env` file on Windows, configure the following variables:

```env
# Switch primary AI provider to Ollama
AI_PROVIDER=ollama

# Reserved ngrok tunnel URL and model
OLLAMA_BASE_URL=https://your-reserved-domain.ngrok-free.dev
OLLAMA_MODEL=llama3.2:1b

# Authenticated tunnel token (generated by Colab startup cell)
OLLAMA_AUTH_TOKEN=Basic <base64_encoded_credentials>

# Request timeout (300000 ms = 5 minutes for GPU inference + tunnel latency)
OLLAMA_TIMEOUT_MS=300000

# Keep Gemini and OpenRouter configured for automatic fallback
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
```

---

## Step 7: Verify Connectivity from Your Local Machine

Open PowerShell or terminal on your Windows development machine and run the following verification commands:

### 1. Model Listing Probe (`/api/tags`)
```powershell
curl.exe -i -X GET "https://your-reserved-domain.ngrok-free.dev/api/tags" `
  -H "Authorization: Basic <base64_encoded_credentials>" `
  -H "ngrok-skip-browser-warning: true"
```
**Expected Output:** `HTTP/1.1 200 OK` with JSON containing `llama3.2:1b`.

---

### 2. Inference Generation Probe (`/api/generate`)
```powershell
curl.exe -i -X POST "https://your-reserved-domain.ngrok-free.dev/api/generate" `
  -H "Content-Type: application/json" `
  -H "Authorization: Basic <base64_encoded_credentials>" `
  -H "ngrok-skip-browser-warning: true" `
  -d '{"model":"llama3.2:1b","prompt":"Say hello in JSON: {\"message\": \"hello\"}","stream":false,"format":"json"}'
```
**Expected Output:** `HTTP/1.1 200 OK` with valid JSON response containing `{"message": "hello"}`.

---

### 3. Security Check (Unauthenticated Probe)
```powershell
curl.exe -i -X GET "https://your-reserved-domain.ngrok-free.dev/api/tags"
```
**Expected Output:** `HTTP/1.1 401 Unauthorized` with `WWW-Authenticate: Basic realm="ngrok"`. This verifies that unauthenticated access is strictly blocked at the ngrok edge.

---

## Step 8: Colab Runtime Disconnections & Recovery

Google Colab free sessions may disconnect after 90 minutes of inactivity or 12 hours of total duration.

### Automatic Fallback Behavior
If the Colab runtime stops, crashes, or disconnects:
1. `aiService.js` attempts to contact Ollama until the request fails or reaches `OLLAMA_TIMEOUT_MS`.
   > [!NOTE]
   > With `OLLAMA_TIMEOUT_MS=300000` (5 minutes), a request sent to a hanging or ungracefully disconnected tunnel may take up to 5 minutes before timing out and triggering the fallback. Immediate connection failures (such as ngrok returning HTTP 502/503 or connection refused) trigger fallback much faster, but fallback is not instantaneous for hanging connections.
2. Once the Ollama failure or timeout occurs, the platform automatically cascades to **Gemini**.
3. If Gemini is unavailable or exceeds quota/rate limits, it cascades further to **OpenRouter**.
4. While the fallback chain prevents complete failure, candidates may experience a delay equal to the configured timeout duration during an active disconnection.

### Instant Recovery Steps
When returning to continue using Ollama:
1. Open your Colab notebook and ensure the runtime is set to **T4 GPU**.
2. Run the startup cell in **Step 4**.
3. **Google Drive Persistence**: The cell mounts Drive and loads `llama3.2:1b` immediately from `/content/drive/MyDrive/ollama_models` without re-downloading (~0 seconds).
4. **Reserved Domain Persistence**: Because you configured a static reserved domain, the public tunnel URL remains identical.
5. **No `.env` Changes Needed**: Your local backend `server/.env` does not need to be modified. Once the cell finishes self-testing, your AI Interview Platform immediately resumes routing requests to Ollama.
