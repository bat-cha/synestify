# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What it does

- 🎯 Search any Spotify track with instant results
- 🎨 Generate real-time visualizations based on musical DNA (energy, valence, tempo, harmony)
- 🧬 Analyze audio features like danceability, acousticness, and emotional valence
- ⚡ Stream 30-second previews synchronized with visual effects
- 🌍 Works globally with edge computing for minimal latency

## Development Commands

```bash
# Development
npm run dev          # Start Vite development server
npm run build        # Build for production (TypeScript compile + Vite build)
npm run preview      # Preview production build locally

# Code Quality
npx tsc --noEmit     # Type checking only
npx eslint src/      # Lint source files
npx vitest           # Run tests
```

## Architecture

This is a Spotify music visualizer built with Vite + TypeScript. The project includes:
- Frontend visualization using Canvas for real-time music visualization
- Spotify Web API integration via Vercel Edge Functions
- Client-side audio features visualization

## Key Technologies

- **Build System**: Vite 7.0+ with TypeScript 5.8+
- **Testing**: Vitest 3.2+
- **Linting**: ESLint with TypeScript rules
- **API**: Vercel Edge Functions for Spotify integration

## Quick Start

```bash
# Development
npm run dev          # Frontend only
vercel dev           # With API functions (requires setup)

# Environment setup
cp .env.example .env.local
# Add your Spotify credentials to .env.local
```

## Current Implementation

The project includes:
- ✅ Vercel Edge Functions for Spotify API integration
- ✅ Basic Vite + TypeScript setup
- ⏳ Energy visualizer (in development)

## Feature Roadmap

### Phase 1: Core Functionality
- [x] Spotify API integration
- [x] Basic search interface  
- [x] Audio features retrieval
- [ ] Simple energy/valence visualization

### Phase 2: Enhanced Visualizations
- [ ] Multiple visualization modes
- [ ] Real-time audio analysis with Web Audio API
- [ ] Harmonic space navigation
- [ ] Rhythm pattern visualization

### Phase 3: Advanced Features
- [ ] Genre-specific visualizations
- [ ] Personal music taste analysis
- [ ] Social sharing capabilities
- [ ] Export to video/images

### Phase 4: AI Integration
- [ ] Machine learning for visual pattern recognition
- [ ] Generative visualizations
- [ ] Cross-cultural music analysis
- [ ] Recommendation-based visual discovery

## Troubleshooting

**Common Issues:**

1. **HTTPS Required**: Use `vercel dev` for local HTTPS
2. **CORS Errors**: Check redirect URI matches exactly
3. **Token Expiration**: Implement refresh logic
4. **Rate Limiting**: Use client credentials for public data
5. **No Preview URL**: ~30% of tracks lack previews

**Debug Tools:**
- Browser DevTools Network tab
- Vercel function logs
- Spotify API Console for testing

## Resources

### Documentation
- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api/)
- [Vercel Edge Runtime](https://vercel.com/docs/functions/edge-functions)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

### Inspiration
- [Music Animation Machine](https://www.musanim.com/)
- [Shape of Song](https://www.bewitched.com/song.html)
- [Groove Pizza](https://apps.musedlab.org/groovepizza)