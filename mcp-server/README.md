# 🚀 WhatsBridge Model Context Protocol (MCP) Server

Connect **WhatsBridge** with **Claude Desktop**, **ChatGPT (Custom GPTs / Actions)**, **Cursor**, **Windsurf**, and any AI agent framework (LangChain, CrewAI, AutoGen, LlamaIndex).

This MCP server gives LLMs the tools to:
- 💬 **Send WhatsApp Messages** directly to customer phones via WhatsApp Web QR or Meta API.
- 🔐 **Send WhatsApp OTPs** (secure 6-digit codes with expiry and rate limiting).
- ✅ **Verify WhatsApp OTPs** and obtain signed proof tokens.
- 📢 **Broadcast Bulk WhatsApp Messages** safely with automatic anti-spam pacing.
- 📶 **Inspect WhatsApp Connections** and real-time link status (`CONNECTED`, `PAIRING`, `DISCONNECTED`).

---

## 📦 Quick Installation

Inside your python environment (Python 3.10+):
```bash
pip install -r requirements.txt
```

---

## ⚙️ Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `WHATSBRIDGE_API_KEY` | Your project API Key (`wb_live_...` or `wb_test_...`) | *(Required)* |
| `WHATSBRIDGE_CONNECTION_ID` | Default WhatsApp Connection UUID | *(Recommended)* |
| `WHATSBRIDGE_BASE_URL` | WhatsBridge Backend Endpoint | `https://whatsbridge-backend.onrender.com` |
| `WHATSBRIDGE_PROJECT_ID` | Optional Project UUID for scoping | *(Optional)* |

---

## 🤖 1. Setup in Claude Desktop

Add this configuration to your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "whatsbridge": {
      "command": "python3",
      "args": [
        "/Users/shiyasahmad/Documents/Codex/2026-10-27/referenced-chatgpt-conversation-this-is-an/outputs/whatsbridge/mcp-server/server.py"
      ],
      "env": {
        "WHATSBRIDGE_BASE_URL": "https://whatsbridge-backend.onrender.com",
        "WHATSBRIDGE_API_KEY": "YOUR_API_KEY_HERE",
        "WHATSBRIDGE_CONNECTION_ID": "76654f80-a758-4144-9354-558c717d5376"
      }
    }
  }
}
```

Restart Claude Desktop, and you will see the 🔨 tool icons for WhatsApp messaging and OTPs!

---

## 🧠 2. Setup in ChatGPT / OpenAI Custom GPTs

For ChatGPT Custom GPTs, OpenAI uses OpenAPI Schema actions:

1. Open [chatgpt.com](https://chatgpt.com) &rarr; **Explore GPTs** &rarr; **Create a GPT**.
2. Go to **Configure** &rarr; **Actions** &rarr; **Create new action**.
3. Copy and paste the contents of [`openai-actions.json`](openai-actions.json).
4. Under **Authentication**:
   - **Auth Type:** `API Key`
   - **Auth Type format:** `Bearer`
   - **API Key:** Paste your WhatsBridge API key (`wb_live_...`).
5. Save the GPT! Now ChatGPT can interact with WhatsApp customers autonomously.

---

## 🔮 3. Setup with Google Gemini (Function Calling / Agents)

You can connect **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`) directly to WhatsBridge using native function calling with the official `google-genai` SDK:

```python
from google import genai
from google.genai import types
from gemini_agent import send_whatsapp_message, send_whatsapp_otp, verify_whatsapp_otp

client = genai.Client(api_key="YOUR_GEMINI_API_KEY")

# Pass WhatsBridge tools directly to Gemini
response = client.models.generate_content(
    model='gemini-2.5-flash',
    contents="Send a WhatsApp message to +919567334117 saying 'Your order has shipped!'",
    config=types.GenerateContentConfig(
        tools=[send_whatsapp_message, send_whatsapp_otp, verify_whatsapp_otp],
        system_instruction="You are an autonomous WhatsApp assistant. Use WhatsBridge tools to fulfill user messaging requests."
    )
)

print(response.text)
```

See [`gemini_agent.py`](gemini_agent.py) for the complete reference implementation.

---

## 💻 4. Setup in Cursor / Windsurf

In Cursor settings &rarr; **Features** &rarr; **MCP Servers** &rarr; **Add New MCP Server**:
- **Name:** `whatsbridge`
- **Type:** `command`
- **Command:** `python3 /Users/shiyasahmad/Documents/Codex/2026-10-27/referenced-chatgpt-conversation-this-is-an/outputs/whatsbridge/mcp-server/server.py`

---

## 🛠️ Available MCP Tools

### `send_whatsapp_message`
Sends a text message to any phone number.
- `phone`: Recipient E.164 phone number (e.g. `+919567334117`).
- `text`: Message body.

### `send_whatsapp_otp`
Dispatches a 6-digit verification code.
- `phone`: Recipient phone (e.g. `+919567334117`).
- `ttl_seconds`: Validity (default: 300).

### `verify_whatsapp_otp`
Validates user-entered code.
- `challenge_id`: Challenge UUID from `send_whatsapp_otp`.
- `code`: The 6-digit code entered by the user.

### `send_bulk_whatsapp_broadcast`
Broadcasts message to an array of recipients with anti-spam pacing.
- `phones`: List of numbers.
- `body`: Text content.

### `list_whatsapp_connections`
Lists WhatsApp transports and current connectivity status.

