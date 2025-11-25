# Coding Style and Conventions for DA_calc

## TypeScript Conventions
- **Strict Mode**: Enabled in tsconfig.json
- **Module System**: ESNext modules with bundler resolution
- **Import Paths**: Use @/* alias for src/* imports

## File Naming
- Components: PascalCase (e.g., `ComponentName.tsx`)
- Utilities/Libraries: camelCase (e.g., `yamlLoader.ts`, `csvLoader.ts`)
- Type definitions: camelCase with `.ts` extension (e.g., `data.ts`)

## Type Definitions
- Define interfaces for all data structures
- Use TypeScript strict typing
- Separate type definitions in `/src/types/` directory

## Data Handling
- YAML files for configuration/formula data
- CSV files for equipment and job data
- UTF-8 encoding for all data files (Japanese text support)

## Project Structure
- `/src/lib/data/` - Data loading utilities
- `/src/types/` - TypeScript type definitions
- `/src/store/` - Zustand state management
- `/src/components/` - React components
- `/src/app/` - Next.js App Router pages

## Next.js Specific
- App Router pattern
- Server Components when possible
- Client Components when state/interactivity needed

## Code Organization
- Export all loaders from index.ts
- Provide initialization utilities
- Keep data loading logic separate from components