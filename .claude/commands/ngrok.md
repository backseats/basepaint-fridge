---
description: Start an ngrok tunnel to expose local development server
---

Start an ngrok tunnel for the current development server.

Ask the user which port to tunnel to (common ports: 3000, 3001, 3003, 8080).

Steps:
1. Ask which port to tunnel to
2. Check if ngrok is installed (`which ngrok`)
3. Start ngrok in the background: `ngrok http <port>`
4. Wait 2-3 seconds for ngrok to start
5. Fetch the public URL: `curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1`
6. Display the URL to the user in a clear, prominent way

Important:
- Run ngrok in the background using `run_in_background: true`
- If ngrok is not installed, tell the user to install it: `brew install ngrok` (macOS) or visit https://ngrok.com/download
