# Clipbodo

A minimalist clipboard inspector. Paste, drop, or read clipboard contents to inspect all MIME types, items, and files.

## Features

- **Paste** (`⌘V` / `Ctrl+V`) — captures all clipboard types via the DataTransfer API, including custom MIME types
- **Drag & Drop** — drop files or content onto the page to inspect
- **Read Clipboard** button — uses the async Clipboard API (limited to standard types)
- **Copy as text** — copy any text entry back as plain text
- **Dark / Light theme** — toggle with the theme button, respects system preference
- **WCAG AA contrast** — all text passes accessibility contrast requirements

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui (Radix Lyra style)
- Remix Icons
- Vite

## Getting Started

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
pnpm preview
```

## Deploy

Deployed to GitHub Pages via GitHub Actions. On every push to `main`, the workflow at `.github/workflows/deploy.yml` builds and deploys to:

**https://robertkibet.github.io/clipbodo/**

## License

MIT
