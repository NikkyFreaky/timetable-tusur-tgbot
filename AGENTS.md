# AGENTS.md

This file provides guidance for agentic coding agents working in this repository.

## Project Overview

This is a Next.js 16 + React 19 + TypeScript web application for TUSUR university timetable. It's a Telegram Mini App with Supabase backend, using Tailwind CSS 4 and Radix UI components.

## Build/Lint/Test Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type checking (not in package.json - run tsc directly)
npx tsc --noEmit
```

**Note:** This project currently has no test framework configured. When adding tests, consider using Jest or Vitest with React Testing Library.

## Code Style Guidelines

### Imports

- Use single quotes for all imports
- Use `@/*` path alias for internal imports (configured in tsconfig.json)
- Import types with the `type` keyword: `import type { User } from "@/lib/types"`
- Group imports in this order: 1) External libraries, 2) Internal imports, 3) Styles
- Use default import for React: `import React from "react"` (or use `import * as React`)
- Named imports for React hooks: `import { useState, useEffect } from "react"`

Example:
```ts
import React from "react"
import { useState, useEffect } from "react"
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { UserSettings } from "@/lib/schedule-types"
import { cn } from "@/lib/utils"
```

### Formatting

- Use single quotes for strings
- Omit semicolons (codebase style is no semicolons)
- Use 2-space indentation
- Use arrow functions for callbacks and short functions
- Keep lines under 100 characters when possible

### TypeScript Types

- Strict mode is enabled in tsconfig.json
- Define interfaces for all data structures
- Use `type` for type aliases, `interface` for object shapes
- Use `readonly` for immutable properties
- Leverage utility types (Partial, Omit, Pick, etc.)

Example:
```ts
interface UserSettings {
  facultySlug: string | null
  groupName: string | null
  notificationsEnabled: boolean
}

type ApiResponse<T> = {
  success: boolean
  data: T | null
  error?: string
}
```

### Naming Conventions

- **Variables/Functions**: camelCase (`userId`, `fetchData`)
- **Components**: PascalCase (`LessonCard`, `ScheduleGrid`)
- **Constants**: UPPER_SNAKE_CASE (`TELEGRAM_API`, `LESSON_TYPES`)
- **Interfaces/Types**: PascalCase (`UserSettings`, `ApiResponse`)
- **Files**: kebab-case for components (`lesson-card.tsx`), kebab-case or camelCase for utilities (`schedule-data.ts`)

### Error Handling

- API routes: wrap in try/catch, return NextResponse.json with appropriate status codes
- Console errors: use `console.error()` with descriptive messages
- Client-side: show user-friendly error messages (consider toast notifications)
- Always log errors with context

Example:
```ts
export async function GET(request: Request) {
  try {
    // ... logic
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Failed to load data:", error)
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 })
  }
}
```

### React Components

- Use functional components with TypeScript
- Add `"use client"` directive at the top for client components
- Define props interfaces above the component
- Destructure props in function signature
- Use the `cn()` utility for conditional class names (tailwind-merge + clsx)

Example:
```tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface LessonCardProps {
  lesson: Lesson
  isActive?: boolean
  className?: string
}

export function LessonCard({ lesson, isActive, className }: LessonCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn("p-4 rounded-xl", isActive && "ring-2", className)}>
      {/* content */}
    </div>
  )
}
```

### API Routes

- Use Next.js App Router conventions (`app/api/.../route.ts`)
- Export named HTTP method handlers (GET, POST, PUT, DELETE)
- Validate request parameters before processing
- Use `export const runtime = "nodejs"` for Node.js specific operations
- Set appropriate Cache-Control headers for GET requests

Example:
```ts
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  return NextResponse.json({ data: result })
}

export async function POST(request: Request) {
  const body = await request.json()
  // ... process
  return NextResponse.json({ success: true })
}
```

### Styling with Tailwind CSS

- Use Tailwind utility classes for all styling
- Import Tailwind via `@import 'tailwindcss';` in globals.css
- Use the `cn()` utility for conditional classes
- Follow existing color tokens (background, foreground, primary, etc.)
- Use responsive prefixes (`md:`, `lg:`) when needed
- Use dark mode with `dark:` prefix

Example:
```tsx
<div className="bg-card text-foreground p-4 rounded-xl border border-border">
  <h2 className="text-lg font-semibold mb-2">Title</h2>
  <p className="text-muted-foreground text-sm">Description</p>
</div>
```

### Additional Notes

- This project uses Supabase for database operations
- Telegram integration: use the Telegram context provider (`@/lib/telegram-context`)
- Use `date-fns` for date manipulation
- Use `zod` for validation when needed
- The project uses TypeScript path alias `@/*` for imports from root
- No ESLint config is present - TypeScript compiler provides linting
