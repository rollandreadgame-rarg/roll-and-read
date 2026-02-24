# Roll and Read

A gamified, structured phonics reading game built on the science of reading.

## Quick Start

### Prerequisites
- Node.js 18+
- A Convex account (free at convex.dev)
- A Clerk account (free at clerk.com)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Convex**
   ```bash
   npx convex dev
   ```
   This will create your Convex deployment and generate type files.

3. **Configure environment variables**
   Copy `.env.local` and fill in your actual keys:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   CLERK_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   ```

4. **Seed the database**
   ```bash
   npx convex run seedWordLists:seedWordLists
   npx convex run seedStickers:seedStickers
   ```

5. **Add audio files**
   Place audio files in `/public/audio/` (see `/public/audio/README.txt`)

6. **Run development server**
   ```bash
   npm run dev
   ```

### Tech Stack
- **Framework**: Next.js 16 App Router + TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion + Lottie
- **Database**: Convex (real-time, serverless)
- **Auth + Billing**: Clerk
- **TTS**: Web Speech API (Phase 2: Kokoro TTS / Piper TTS)
- **Audio**: Howler.js

### Project Structure
```
app/
  (public)/     # Landing page (no auth)
  (app)/        # Authenticated app
    play/       # Main game screen
    word-bank/  # Word collection
    sticker-book/ # Sticker collection
    shop/       # Spend coins
    dashboard/  # Parent progress view
    settings/   # Profile, theme, audio
convex/         # Backend functions + schema
components/
  game/         # Core game components
  celebrations/ # Animations and modals
  navigation/   # Nav components
hooks/          # React hooks
lib/            # Utilities and game logic
providers/      # React context providers
public/
  audio/        # Sound effects (add manually)
  lottie/       # Lottie animations (add manually)
```

### Deploying to Vercel
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

---

Built with love for every child who learns differently.
