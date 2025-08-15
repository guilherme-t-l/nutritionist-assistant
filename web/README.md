# Nutritionist Assistant - MVP (Milestone 1)

An AI-powered nutritionist assistant that provides conversational guidance on nutrition, food choices, and meal planning.

## ⚠️ Important Disclaimer

**This application provides educational nutrition guidance only and is not intended as medical advice. Always consult with qualified healthcare professionals for medical concerns, dietary restrictions due to health conditions, or specific medical nutrition therapy.**

## Features

- 🤖 **Conversational AI Assistant**: Chat with a knowledgeable nutritionist AI
- 🔄 **Streaming Responses**: Real-time response generation for better UX
- 💭 **Session Memory**: Maintains context across conversation turns (up to 20 messages)
- 🍎 **Preference Awareness**: Respects allergies, dislikes, cuisine preferences, and budget
- 🔀 **Provider Flexibility**: Switch between OpenAI (server) and WebLLM (local) providers
- 📝 **Meal Plan Integration**: Can view and edit meal plans alongside conversations
- 🛡️ **Safety Guardrails**: Built-in safety measures and refusal patterns

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (for server-side provider)

### Installation

1. **Clone and navigate to the web directory:**
   ```bash
   cd web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open the application:**
   Navigate to `http://localhost:3000` in your browser.

## Usage

### Basic Chat
- Type nutrition questions in the message box
- Get real-time streaming responses
- Session context is preserved automatically

### Setting Preferences
Use the preference inputs above the chat to set:
- **Allergies**: Comma-separated list (e.g., "nuts, shellfish")
- **Dislikes**: Foods you prefer to avoid
- **Cuisine**: Preferred cuisine type
- **Budget**: Low, Medium, or High

### Provider Selection
- **OpenAI (server)**: Uses your API key, requires internet
- **Local (WebLLM)**: Runs locally in browser, no API key needed (slower initial load)

### Example Questions
- "What's a healthy breakfast for weight loss?"
- "I'm allergic to nuts. What protein snacks do you recommend?"
- "Can you suggest a vegetarian meal plan?"
- "What are the macros for 100g of chicken breast?"

## Technical Details

### Architecture
- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwind CSS
- **Backend**: Next.js API routes with streaming support
- **AI Providers**: OpenAI GPT-4o-mini or local WebLLM models
- **Session Management**: In-memory storage with automatic cleanup
- **State Management**: React hooks with context for meal planning

### API Endpoints
- `POST /api/chat`: Main chat endpoint with streaming responses
  - Supports both OpenAI and WebLLM providers
  - Handles session memory and preferences
  - Returns Server-Sent Events for streaming

### Session Management
- Sessions auto-expire after 4 hours of inactivity
- Up to 20 messages preserved per session
- HTTP-only cookies for session tracking
- Automatic cleanup of expired sessions

## Development

### Running Tests
```bash
# Unit tests
npm test

# End-to-end tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui
```

### Code Quality
```bash
# Linting
npm run lint

# Type checking
npx tsc --noEmit
```

### Building for Production
```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for server provider | Yes* | - |
| `OPENAI_MODEL` | OpenAI model to use | No | gpt-4o-mini |
| `NODE_ENV` | Environment mode | No | development |

*Required only when using OpenAI provider

## Safety & Privacy

### Safety Measures
- System prompt includes nutritionist role boundaries
- Refuses medical diagnosis and treatment advice
- Includes appropriate disclaimers
- Respects user allergies and dietary restrictions

### Privacy
- Session data stored in memory only (not persisted)
- Automatic cleanup of expired sessions
- No message content logged by default
- HTTP-only cookies for session management

## Known Limitations

- Session memory is not persistent across server restarts
- Local WebLLM models have slower initial load times
- Currently supports only OpenAI for server-side processing
- No user authentication or persistent user profiles

## Troubleshooting

### Common Issues

1. **"Request failed" errors**
   - Check your OpenAI API key in `.env.local`
   - Verify your internet connection
   - Try switching to WebLLM provider for local processing

2. **Slow responses**
   - OpenAI responses depend on internet speed
   - WebLLM models need initial download (one-time)
   - Check browser console for detailed error messages

3. **Session not persisting**
   - Sessions are memory-only and reset on server restart
   - Check that cookies are enabled in your browser

### Getting Help

1. Check the browser console for error messages
2. Verify environment variables are set correctly
3. Try different providers (OpenAI vs WebLLM)
4. Clear browser cache and cookies if issues persist

## Roadmap

See `DEVELOPMENT_PLAN.md` for upcoming milestones:
- M2: Nutrition database integration
- M3: Smart substitution engine
- M4: Advanced preferences and restrictions
- M5: Nutritionist workflow UI
- M6: Performance and security hardening
