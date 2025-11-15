# Podcastify - Multilingual Podcast Generator

Podcastify is a modern web application that transforms blog posts into multilingual podcast audio files. Simply paste a blog URL, and the application will scrape the content, generate chapters, translate them into multiple languages, and create high-quality audio files for each language.

## Technologies Used

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **Shadcn UI** - Component library built on Radix UI
- **React Flow** - Node-based canvas for visualizing podcast workflow
- **Lingo.dev** - Internationalization (i18n) library
- **Next Themes** - Dark/light theme support
- **Sonner** - Toast notifications

### Backend & Processing
- **Inngest** - Background job processing for audio generation
- **Mozilla Readability** - Content extraction from web pages
- **OpenRouter** - AI-powered content summarization and translation
- **Text-to-Speech API** - Audio generation from text

### Utilities
- **JSZip** - Creating zip archives for audio downloads
- **Lucide React** - Icon library
- **Date-fns** - Date manipulation

## File Structure

```
podcastify/
├── app/
│   ├── api/                    # API routes
│   │   ├── chapters/           # Chapter generation endpoint
│   │   ├── scrape/             # Blog content scraping
│   │   ├── summarize-chapters/ # AI summarization
│   │   ├── translate-chapter/  # Translation endpoints
│   │   ├── tts/                # Text-to-speech (sync)
│   │   ├── tts-async/          # Text-to-speech (async)
│   │   ├── merge-audio/        # Audio merging
│   │   ├── zip-audio/          # Audio zipping
│   │   ├── jobs/               # Job status tracking
│   │   └── inngest/            # Inngest webhook
│   ├── globals.css             # Global styles and animations
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main home page
├── components/
│   ├── podcast-flow.tsx        # Main canvas component
│   ├── chapter-card.tsx        # Chapter display card
│   ├── loading-screen.tsx      # Loading states
│   ├── jobs-viewer.tsx         # Background jobs viewer
│   ├── language-switcher.tsx   # Language selection
│   ├── theme-toggle.tsx        # Dark/light theme toggle
│   ├── translation-loader.tsx # i18n loader
│   ├── LightRays.tsx          # Background effect
│   ├── PrismaticBurst.tsx     # Background effect
│   └── ui/                     # Shadcn UI components
├── lib/
│   ├── cache.ts               # LocalStorage caching
│   ├── lingo.tsx              # i18n configuration
│   ├── inngest/               # Inngest client and functions
│   │   ├── client.ts
│   │   └── functions.ts
│   ├── jobs-store.ts          # Job state management
│   └── utils.ts               # Utility functions
├── hooks/
│   └── use-mobile.ts          # Mobile detection hook
├── public/
│   └── audio/                 # Generated audio files storage
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

## How to Download and Run

### Prerequisites
- Node.js 18+ installed
- npm, yarn, pnpm, or bun package manager
- OpenRouter API key (for AI features)
- Text-to-Speech API access (configure in environment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd podcastify
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   TTS_API_KEY=your_tts_api_key
   INNGEST_EVENT_KEY=your_inngest_key
   INNGEST_SIGNING_KEY=your_inngest_signing_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` (or the port shown in terminal)

### Build for Production

```bash
npm run build
npm start
```

## Current Features

### Core Functionality
- **Blog URL Input** - Paste any blog URL to extract content
- **Chapter Generation** - Automatically generates chapters from blog content
- **Customizable Chapter Count** - Select 1-10 chapters for summarization (default: 3)
- **Content Scraping** - Extracts clean text content from web pages using Mozilla Readability
- **AI Summarization** - Uses OpenAI to summarize content into specified number of chapters

### Multilingual Support
- **18+ Languages** - Support for English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Japanese, Korean, Chinese, Arabic, Hindi, Turkish, Swedish, Norwegian, Danish, and Finnish
- **Translation** - Automatic translation of chapters into selected languages
- **Language Switcher** - Easy language selection with visual indicators

### Audio Generation
- **Text-to-Speech** - Generates high-quality audio files for each chapter and language
- **Background Processing** - Async audio generation using Inngest for better performance
- **Audio Player** - Built-in audio player in modal for preview
- **Download Options**:
  - Individual audio downloads
  - Bulk download (zip all selected audios)
  - Merge multiple audios of the same language

### User Interface
- **Interactive Canvas** - React Flow-based visual workflow representation
- **Node-Based Design**:
  - Chapter nodes with content viewing
  - Circular audio nodes with language indicators
  - Merge group nodes for combining audios
- **Dark/Light Theme** - Full theme support with smooth transitions
- **Responsive Design** - Works on desktop and mobile devices
- **Session Persistence** - Automatically saves and restores work on page reload

### Caching System
- **Smart Caching** - Caches chapters, translations, and audio files
- **Chapter Count Aware** - Cache is specific to URL + chapter count combination
- **LocalStorage** - Client-side caching for faster subsequent loads
- **Session Management** - Maintains state across page reloads

### Advanced Features
- **Audio Selection** - Multi-select audio nodes with checkboxes
- **Merge Groups** - Create groups to merge multiple audio files
- **Dynamic Layout** - Auto-adjusting chapter rectangles to prevent overlaps
- **Visual Feedback**:
  - Animated gradient borders during audio generation
  - Loading states and progress indicators
  - Toast notifications for user actions
- **Job Tracking** - View and monitor background audio generation jobs

## Future Scope

### Planned Features
- **Export Formats** - Support for MP3, OGG, and other audio formats
- **Audio Quality Settings** - Configurable bitrate and sample rate
- **Voice Selection** - Choose different voices per language
- **Playback Speed Control** - Adjust audio playback speed
- **Chapter Timestamps** - Add timestamps to audio files
- **Batch Processing** - Process multiple URLs at once
- **Cloud Storage Integration** - Save to Google Drive, Dropbox, etc.
- **Podcast RSS Feed Generation** - Auto-generate RSS feeds for podcast platforms
- **Custom Voice Training** - Upload custom voice samples
- **Audio Effects** - Add background music, sound effects
- **Collaboration** - Share projects with team members
- **Analytics Dashboard** - Track usage and generation statistics
- **API Access** - RESTful API for programmatic access
- **Webhook Support** - Notify external services on completion
- **Mobile App** - Native iOS and Android applications

### Technical Improvements
- **Performance Optimization** - Further optimize audio generation pipeline
- **Caching Strategy** - Implement server-side caching
- **Error Recovery** - Better error handling and retry mechanisms
- **Testing** - Comprehensive unit and integration tests
- **Documentation** - API documentation and developer guides
- **Accessibility** - Enhanced screen reader support and keyboard navigation
