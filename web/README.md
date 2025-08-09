This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Nutritionist Co‑Pilot (MVP)

Implements Milestone M1 of `DEVELOPMENT_PLAN.md`:
- Chat UI with streaming responses
- API route `/api/chat` proxying to OpenAI via a provider abstraction
- System prompt with role/scope/safety disclaimers
- Ephemeral in‑memory session memory
- Basic logging

### Getting Started

1) Copy envs:

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`.

2) Install dependencies:

```bash
npm install
```

3) Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try the Chat page.

### Notes

- Session memory is in‑process. It resets on server restarts and does not persist across instances.
- Provider switch is wired for a `provider` query param but only OpenAI is implemented.
- Minimal guardrails avoid medical diagnosis/treatment; responses include disclaimers as needed.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
