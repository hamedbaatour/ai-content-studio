# AI Content Studio

An interactive web app for generating and refining short-form social media scripts with AI. Built with Next.js, Tailwind CSS, and shadcn/ui.

## Features

- **Multi-provider AI**: Use Ollama (local), Groq, or Google Gemini.
- **Interactive drafting**: Generate a structured script from a feature description and usefulness statement.
- **Part-by-part refinement**: Edit each segment (Hook, Problem, Solution, Benefit, CTA) independently.
- **Quick feedback**: One-click buttons to make segments shorter, longer, less cheesy, more human, more hypey, or rewrite them.
- **Text selection suggestions**: Highlight any text to get AI marketer suggestions or write a custom prompt inline.
- **Global controls**: Adjust tone, style, and length with sliders and instantly regenerate.
- **Feedback history**: Every action is logged to IndexedDB and used to personalize future prompts.
- **Version history**: Save snapshots and restore previous versions.
- **Export**: Copy or download scripts as `.txt` or `.md`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI Provider Setup

### Google Gemini
1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Paste it into the **AI Provider** settings in the app.

### Groq
1. Get an API key from [Groq Console](https://console.groq.com/keys).
2. Paste it into the **AI Provider** settings.

### Ollama (local)
1. Install [Ollama](https://ollama.com).
2. Pull a model: `ollama pull llama3.2`
3. Run with CORS enabled:
   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```
4. Select **Ollama** in the app settings.

## Deployment

The app is configured for static export (`output: 'export'`).

```bash
npm run build
```

The static site is generated in the `dist` folder. Deploy it to Vercel, Netlify, Cloudflare Pages, or any static host.

### Deploy to Vercel

```bash
npx vercel --prod
```

Or drag the `dist` folder into [Vercel's web UI](https://vercel.com/new).

## Feedback Database Migration to Turso

Feedback is currently stored in the browser using IndexedDB. To migrate to Turso later:

1. Use the `exportFeedbackToJSON()` helper in `lib/db/feedback-db.ts`.
2. Parse the JSON and import each log into your Turso database.
3. Replace the IndexedDB reads/writes with Turso client calls.

## Project Structure

```
app/                  # Next.js app routes
components/
  steps/              # Input, Review, Export steps
  script/             # Segment cards, global controls, selection toolbar
  providers/          # AI provider settings UI
  ui/                 # shadcn components
lib/
  ai/                 # Provider clients and prompt builders
  db/                 # IndexedDB feedback store
  personalization.ts  # Preference aggregation
stores/               # Zustand app state
```

## License

MIT
