# OpenAI Server Setup Guide

This guide will help you set up OpenAI server functionality for the Nutritionist Assistant.

## 🎯 Quick Setup

### 1. Get an OpenAI API Key
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Create a new secret key
4. Copy the key (starts with `sk-`)

### 2. Configure Environment Variables
1. **Copy the example environment file:**
   ```bash
   cd web
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with your API key:**
   ```bash
   # OpenAI Configuration
   OPENAI_API_KEY=sk-your-actual-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   NODE_ENV=development
   ```

### 3. Install Dependencies & Start
```bash
cd web
npm install
npm run dev
```

### 4. Test the Integration
1. Open http://localhost:3000
2. Select "OpenAI (server)" from the provider dropdown
3. Send a nutrition question like "What's a healthy breakfast?"
4. You should see a streaming response

## 🔧 How It Works

### Architecture Overview
```
Frontend (Chat.tsx) 
    ↓ HTTP POST to /api/chat?provider=openai
API Route (/api/chat/route.ts)
    ↓ Uses OpenAILLMClient
OpenAI Client (openaiClient.ts)
    ↓ Streams response
Back to Frontend (Server-Sent Events)
```

### Key Components

1. **Environment Configuration**: `.env.local` contains your API key
2. **API Route**: `/api/chat/route.ts` handles OpenAI requests
3. **OpenAI Client**: `src/lib/llm/openaiClient.ts` manages OpenAI API calls
4. **Session Management**: `src/lib/llm/sessionManager.ts` maintains conversation history
5. **Frontend**: `src/components/Chat.tsx` handles provider selection and streaming

### Session Management
- Conversations are maintained server-side using session IDs
- Full conversation history is sent to OpenAI for context
- Sessions auto-expire after 24 hours
- Memory is cleared on server restart (in-memory storage)

## 🚨 Troubleshooting

### "Request failed: 400" or "Only OpenAI is supported server-side"
- Make sure you selected "OpenAI (server)" not "Local (WebLLM)"
- Check that the provider query parameter is set correctly

### "Request failed: 401" or Unauthorized
- Verify your API key is correct in `.env.local`
- Make sure the key starts with `sk-`
- Check your OpenAI account has credits

### "Request failed: 429" or Rate Limit
- You've exceeded OpenAI's rate limits
- Wait a few minutes or upgrade your OpenAI plan

### No Response or Slow Response
- Check your internet connection
- Verify OpenAI service status
- Try a different model (set `OPENAI_MODEL=gpt-3.5-turbo` for faster responses)

### Session Context Not Working
- Sessions are memory-only and reset on server restart
- Make sure you're using the same browser/tab for conversation continuity
- Check browser console for any sessionId errors

## 📊 Supported Models

Set the `OPENAI_MODEL` environment variable to use different models:

| Model | Speed | Cost | Quality | Best For |
|-------|-------|------|---------|----------|
| `gpt-4o-mini` | ⚡⚡⚡ | 💰 | ⭐⭐⭐ | **Default - Balanced** |
| `gpt-3.5-turbo` | ⚡⚡⚡⚡ | 💰 | ⭐⭐ | Fast responses |
| `gpt-4` | ⚡⚡ | 💰💰💰 | ⭐⭐⭐⭐⭐ | Highest quality |
| `gpt-4-turbo` | ⚡⚡⚡ | 💰💰 | ⭐⭐⭐⭐ | Good balance |

## 🔒 Security Notes

- Never commit your `.env.local` file to git
- Keep your API key secret
- Monitor your OpenAI usage to avoid unexpected charges
- The application includes built-in safety measures for nutrition advice

## 🆚 OpenAI vs WebLLM

| Feature | OpenAI (Server) | WebLLM (Local) |
|---------|----------------|-----------------|
| **Setup** | API key required | No setup needed |
| **Performance** | ⚡⚡⚡⚡ Fast | ⚡⚡ Slower initial load |
| **Cost** | Pay per token | Free |
| **Privacy** | Data sent to OpenAI | Fully local |
| **Quality** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good |
| **Internet** | Required | Not required after download |

## ✅ Verification Checklist

- [ ] API key is set in `.env.local`
- [ ] Dependencies are installed (`npm install`)
- [ ] Development server starts (`npm run dev`)
- [ ] Can select "OpenAI (server)" provider
- [ ] Nutrition questions get streaming responses
- [ ] Conversation context is maintained across messages
- [ ] No console errors in browser

---

**Need help?** Check the main [README.md](./README.md) or [open an issue](../../issues) if you encounter problems.