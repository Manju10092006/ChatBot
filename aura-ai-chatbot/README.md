# Aura AI Chatbot

A production-ready, embeddable AI chatbot powered by **Google Gemini**.

```
User  →  Chatbot Widget (React / HTML)  →  Backend API (Express)  →  Gemini API  →  Response
```

---

## Project Structure

```
CHATBOT/
├── backend/                   # Node.js API server
│   ├── server.js
│   ├── routes/chat.js
│   ├── services/geminiService.js
│   ├── .env
│   └── package.json
│
└── aura-ai-chatbot/           # NPM package + widget
    ├── src/
    │   ├── Chatbot.jsx        # Reusable React component
    │   └── index.js           # Package entry point
    ├── dist/
    │   ├── chatbot-widget.js  # Embeddable vanilla-JS widget
    │   └── test.html          # Widget test page
    ├── package.json
    └── README.md
```

---

## 1. Backend Setup

### Install & Run Locally

```bash
cd backend
npm install
```

Edit `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_actual_gemini_api_key
PORT=5000
```

Start the server:

```bash
npm start        # production
npm run dev      # development (auto-restart on changes)
```

The server runs at `http://localhost:5000`. Test it:

```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'
```

### API Reference

**POST /chat**

Request body:

```json
{
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there!" },
    { "role": "user", "content": "Tell me a joke" }
  ]
}
```

Response:

```json
{
  "reply": "Why did the developer go broke? Because he used up all his cache!"
}
```

---

## 2. React Component Usage

### Install the package

```bash
npm install aura-ai-chatbot
```

### Use in your React app

```jsx
import Chatbot from "aura-ai-chatbot";

function App() {
  return (
    <Chatbot
      apiUrl="https://api.myserver.com/chat"
      botName="Aura"
    />
  );
}
```

### Props

| Prop           | Type     | Default                          | Description                    |
|----------------|----------|----------------------------------|--------------------------------|
| `apiUrl`       | string   | `http://localhost:5000/chat`     | Backend chat endpoint URL      |
| `botName`      | string   | `"Aura"`                        | Bot display name               |
| `quickActions` | array    | Built-in 4 actions              | Welcome screen quick actions   |
| `suggestions`  | array    | Built-in 4 suggestions          | Suggestion chips               |

### Features

- Modern animated chat UI
- Voice input (SpeechRecognition)
- Text-to-speech (SpeechSynthesis)
- File upload with preview
- Drag-and-drop support
- Quick action cards & suggestion chips
- Full conversation history
- Network error handling
- Auto-scroll

---

## 3. Embeddable Widget (No React)

Copy `dist/chatbot-widget.js` to your website, then add:

```html
<script src="chatbot-widget.js"></script>
<script>
  AuraChatbot.init({
    apiUrl: "https://api.myserver.com/chat",
    botName: "Aura"
  });
</script>
```

A floating button appears in the bottom-right corner. Click it to open the chat.

**Test locally:** open `dist/test.html` in your browser (with the backend running).

---

## 4. Deployment

### Deploy Backend on Render

1. Push the `backend/` folder to a GitHub repo.
2. Go to [render.com](https://render.com) → **New Web Service**.
3. Connect your repo and set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add environment variable: `GEMINI_API_KEY` = your key.
5. Deploy. You'll get a URL like `https://aura-backend.onrender.com`.
6. Update your frontend `apiUrl` to `https://aura-backend.onrender.com/chat`.

### Publish NPM Package

```bash
cd aura-ai-chatbot

# Login to npm (one-time)
npm login

# Publish
npm publish
```

If the name `aura-ai-chatbot` is taken, update `package.json` name to a scoped package:

```json
"name": "@yourusername/aura-ai-chatbot"
```

Then publish with:

```bash
npm publish --access public
```

---

## 5. Testing Checklist

- [ ] Backend starts without errors
- [ ] `POST /chat` returns a valid `{ reply }` response
- [ ] React component renders the welcome screen
- [ ] Sending a message shows typing animation then response
- [ ] Voice input works in Chrome
- [ ] TTS reads bot responses aloud
- [ ] File attach shows preview chip
- [ ] Widget opens/closes via FAB button
- [ ] Widget sends/receives messages
- [ ] Errors display gracefully on network failure

---

## License

MIT
