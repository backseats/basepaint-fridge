# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 application using the App Router, React 19, TypeScript, and Tailwind CSS v4. The project integrates Web3 functionality via wagmi and viem libraries for blockchain interactions.

## Technology Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5.x with strict mode enabled
- **Styling**: Tailwind CSS v4 with PostCSS
- **Web3**: wagmi ^3.3.2 and viem 2.x
- **Package Manager**: Bun (as evidenced by bun.lock)
- **Fonts**: Geist Sans and Geist Mono (via next/font)

## Essential Commands

```bash
# Development server (runs on http://localhost:3000)
bun dev

# Production build
bun run build

# Start production server
bun start

# Run linter
bun run lint
```

## Architecture

### App Router Structure

This project uses Next.js App Router with the `app/` directory:
- `app/layout.tsx` - Root layout with font configuration and metadata
- `app/page.tsx` - Home page component
- `app/globals.css` - Global styles including Tailwind directives

### Path Aliases

TypeScript is configured with `@/*` alias pointing to the root directory (tsconfig.json paths):
```typescript
import Component from "@/app/components/Component"
```

### Web3 Integration

The project includes wagmi and viem dependencies for Ethereum/blockchain interactions. These should be configured in the app to provide wallet connection and blockchain state management.

### Styling

- Uses Tailwind CSS v4 (note: this is a newer version with different configuration patterns than v3)
- Dark mode support is implemented via `dark:` variants
- Custom CSS variables defined for Geist fonts: `--font-geist-sans` and `--font-geist-mono`

## TypeScript Configuration

- Target: ES2017
- Strict mode enabled
- Module resolution: bundler
- JSX: react-jsx (not preserve)
- Path alias `@/*` maps to root directory

## Important Notes

- The project uses Bun as the package manager
- `ignoreScripts` and `trustedDependencies` are configured for sharp and unrs-resolver packages
- ESLint uses the modern flat config format (eslint.config.mjs) with Next.js presets
- Global ignores include: .next/, out/, build/, next-env.d.ts
