# Flickster

## Film Bingo

A screening-room proof of concept built with React, TypeScript and Vite. The browser automatically draws a film, loads a TMDB landscape backdrop and shows the release year and up to five actors in billing order.

## Local development

Requires Node.js 22 or newer and a [TMDB API Read Access Token](https://www.themoviedb.org/settings/api).

```sh
npm ci
cp .env.example .env.local
```

Set `TMDB_READ_ACCESS_TOKEN` in `.env.local` and run:

```sh
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173. The development server handles both the UI and `/api/*`. Restart it after updating the token. Keep the token in server-only configuration and use the **API Read Access Token** rather than the shorter API key.

```sh
npm test
npm run build
```

## Selection and testing

The server paginates TMDB Discover to collect up to 500 released English-language movies with backdrops and ratings of at least 6.5. It starts with at least 1,000 votes and tries successive bands down to 750, 500 and 250 if needed. Discover filters out TMDB's anime keyword. Films with missing or incomplete anime tags can slip through, and English-language animation remains eligible. The pool is cached for six hours in each server process or warm Worker isolate.

Rating and release date are normalized over the pool and contribute 65% and 35% respectively to the weighted draw, in addition to a positive baseline weight. Films actually shown are tracked in browser session storage, which survives reloads in the same page session. Use **Reset Session** to clear the history explicitly, including after exhaustion. Depending on browser settings, restoring a closed tab can restore its page session.

Open **Testing Tools** to search TMDB, show a specific film, reset history, force a pool refresh or view diagnostics. Search bypasses the pool filters and still observes session history and backdrop availability. Original-resolution backdrops are ranked with a preference for images without language metadata. Images are preloaded, with alternate backdrops and automatic film retries as needed.

## Cloudflare Workers

The Worker uses the same API implementation as Vite and serves the production build through Workers Static Assets. To test in Wrangler locally, add `TMDB_READ_ACCESS_TOKEN` to an ignored `.dev.vars` file and run `npm run worker:dev`.

To deploy from your Cloudflare account, authenticate Wrangler and set the Worker secret `TMDB_READ_ACCESS_TOKEN` using `npx wrangler secret put TMDB_READ_ACCESS_TOKEN`. Use `npm run deploy` to build and deploy. If provisioning through the dashboard, use its secret settings for the Worker named in `wrangler.jsonc`.

## Attribution

Film data and backdrops are provided by [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.
