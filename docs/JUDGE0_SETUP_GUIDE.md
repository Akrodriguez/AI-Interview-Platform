# 100% Free Code Execution API Setup Guide (OnlineCompiler.io & Judge0)

This platform supports **100% free, zero-cost, hosted code execution** with **no credit card, no paid plan, and no Docker** required.

It uses **OnlineCompiler.io**, a hosted code execution service that provides a dedicated, drop-in **Judge0 CE-compatible API**.

---

## 1. Provider Overview: OnlineCompiler.io

| Feature | Details |
| :--- | :--- |
| **Cost** | **100% Free ($0.00)** |
| **Credit Card Required?** | **No** (Email registration only) |
| **Free Plan Limit** | **100,000 code executions per month** |
| **Rate Limit** | 30 submissions/minute, 2 concurrent runs |
| **API Compatibility** | Native **Judge0 CE REST API** (`/api/judge0`) |
| **Supported Languages** | Python (3.14), JavaScript (Node.js 24), C++ (GCC 15), +35 others |
| **Sandboxing** | Ephemeral isolated containers with time & memory limits |

---

## 2. Step-by-Step Setup (2 Minutes)

### Step 1: Create a Free Account
1. Visit [OnlineCompiler.io](https://onlinecompiler.io).
2. Click **Sign in** or **Get API key**.
3. Sign up with your email (or Google). **No billing details or credit cards are requested.**

### Step 2: Copy Your API Key
1. From your OnlineCompiler.io dashboard, copy your **API Key** (Token).

### Step 3: Configure `server/.env`
Add or update the following variables in your `server/.env` file:

```env
# Hosted Judge0-compatible endpoint on OnlineCompiler.io
JUDGE0_API_URL=https://api.onlinecompiler.io/api/judge0

# Your free OnlineCompiler.io API key
JUDGE0_API_KEY=your_api_key_here

# Request timeout in milliseconds (default: 25000 = 25s)
JUDGE0_TIMEOUT=25000
```

---

## 3. Alternative: Self-Hosted Judge0 CE (Optional, Docker)

If you prefer to run a private instance locally instead of using a hosted cloud provider:

1. Clone and run Judge0 via Docker Compose:
   ```bash
   git clone https://github.com/judge0/judge0.git
   cd judge0
   docker compose up -d
   ```
2. Set in `server/.env`:
   ```env
   JUDGE0_API_URL=http://localhost:3308
   JUDGE0_API_KEY=
   ```

---

## 4. How Language Mapping Works

The backend client automatically selects the appropriate language ID based on your configured `JUDGE0_API_URL`:

| Language | OnlineCompiler.io ID | Standard Judge0 ID |
| :--- | :--- | :--- |
| **Python** | `113` (Python 3.14) | `71` |
| **JavaScript** | `102` (Node.js 24) | `63` |
| **C++** | `105` (GCC 15) | `54` |

---

## 5. Testing Instructions

### Verify with cURL (PowerShell / Terminal)
Once you have your API key, you can test execution directly:

```bash
# Python test
curl -X POST "https://api.onlinecompiler.io/api/judge0/submissions?wait=true" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"language_id": 113, "source_code": "print(42)"}'
```

### Verify inside the Platform
1. Start your backend server (`npm run dev` in `server`).
2. Start the frontend client (`npm run dev` in `client`).
3. Open any **Coding Interview** session on the Dashboard.
4. Click **Run Code** to execute in the cloud sandbox and verify the terminal output.

---

## 6. Known Free Plan Limits & Error Codes

- **Rate Limits (HTTP 429):** The free plan permits up to 30 requests per minute and 2 concurrent runs. If exceeded, the platform displays a clear rate-limit notice asking the user to wait a few seconds.
- **Authentication (HTTP 401/403/404):** If the key is invalid or unset, the system warns the candidate that `JUDGE0_API_KEY` needs verification.
- **Execution Timeouts (HTTP 504):** Long-running code or infinite loops are halted after `JUDGE0_TIMEOUT` (default: 25s).
- **Source Code / Input Caps:** Maximum 64 KB source code and 16 KB custom stdin.
