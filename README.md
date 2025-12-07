# Synapse

A Git-style conversation forking chat application where you can branch conversations at any point and explore different paths with AI.

## Features

- **Conversation Branching**: Fork conversations at any point to explore different AI response paths
- **Tree Visualization**: Visual tree view of conversation branches using React Flow
- **Multi-Model Support**: Switch between multiple AI providers (OpenAI, Anthropic, Google, xAI)
- **Real-time Streaming**: See AI responses stream in real-time as they're generated
- **Context Preservation**: Each branch maintains full context from its parent nodes
- **Tool Call Support**: View and interact with AI tool calls and results
- **Markdown Rendering**: Rich markdown support with syntax highlighting and LaTeX math
- **User Authentication**: Secure authentication via Clerk
- **Persistent Storage**: All conversations stored in Convex database

## Tech Stack

- **Frontend Framework**: [TanStack Start](https://tanstack.com/start) (React SSR)
- **Backend/Database**: [Convex](https://www.convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **AI SDK**: [Vercel AI SDK](https://sdk.vercel.ai/) with support for:
  - OpenAI (GPT-5.1, GPT-4.1, GPT-4o, etc.)
  - Anthropic (Claude Sonnet, Haiku, Opus)
  - Google (Gemini 3 Pro, Gemini 2.5)
  - xAI (Grok 4.1)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [TanStack Query](https://tanstack.com/query) + [Convex React Query](https://github.com/get-convex/convex-react-query)
- **Routing**: [TanStack Router](https://tanstack.com/router)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Code Quality**: [Biome](https://biomejs.dev/)
- **Package Manager**: [pnpm](https://pnpm.io/)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v8 or higher) - Install with `npm install -g pnpm`
- **Convex account** - Sign up at [convex.dev](https://www.convex.dev/)
- **Clerk account** - Sign up at [clerk.com](https://clerk.com/)
- **AI Provider API Keys**:
  - OpenAI API key (required)
  - Anthropic API key (optional, for Claude models)
  - Google API key (optional, for Gemini models)
  - xAI API key (optional, for Grok models)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd synapse
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

#### Required Environment Variables

```env
# Convex Deployment URL (get this from Convex dashboard after deployment)
VITE_CONVEX_URL=https://your-project.convex.cloud

# Clerk Publishable Key (get this from Clerk dashboard)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# OpenAI API Key (required for default models)
OPENAI_API_KEY=sk-...
```

#### Optional Environment Variables

```env
# Additional AI Provider API Keys (only needed if using those models)
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
XAI_API_KEY=xai-...

# Server Configuration
SERVER_URL=https://your-domain.com  # Optional: Custom server URL
MODEL_NAME=gpt-5.1-2025-11-13        # Optional: Override default model
VITE_APP_TITLE=Synapse                # Optional: Custom app title
```

### 4. Set Up Convex

1. **Install Convex CLI** (if not already installed):
   ```bash
   npm install -g convex
   ```

2. **Login to Convex**:
   ```bash
   npx convex login
   ```

3. **Initialize Convex** (if not already initialized):
   ```bash
   npx convex dev
   ```
   This will:
   - Create a new Convex project (or link to existing one)
   - Deploy your schema and functions
   - Provide you with a deployment URL

4. **Copy the Convex URL**:
   After initialization, Convex will provide a deployment URL. Copy it and add it to your `.env` file as `VITE_CONVEX_URL`.

5. **Deploy Schema**:
   The schema is defined in `convex/schema.ts`. Convex will automatically deploy it when you run `npx convex dev`.

### 5. Set Up Clerk

1. **Create a Clerk Application**:
   - Go to [clerk.com](https://clerk.com/) and sign in
   - Create a new application
   - Choose your authentication method (Email, OAuth, etc.)

2. **Get Your Publishable Key**:
   - In the Clerk dashboard, go to "API Keys"
   - Copy the "Publishable key"
   - Add it to your `.env` file as `VITE_CLERK_PUBLISHABLE_KEY`

3. **Configure Redirect URLs** (for production):
   - In Clerk dashboard, go to "Paths"
   - Add your production URL to allowed redirect URLs

### 6. Run the Development Server

```bash
pnpm dev
```

This command will:
- Start the Vite dev server on port 3000
- Start Convex dev mode (watches for changes and hot-reloads)

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Available Scripts

- `pnpm dev` - Start development server with Convex dev mode
- `pnpm build` - Build for production
- `pnpm serve` - Preview production build locally
- `pnpm format` - Format code with Biome
- `pnpm lint` - Lint code with Biome
- `pnpm check` - Run Biome check (format + lint)

### Development Workflow

1. **Making Schema Changes**: Edit `convex/schema.ts` and Convex will automatically detect and deploy changes
2. **Adding Convex Functions**: Create new files in `convex/` directory
3. **Adding Routes**: Create new files in `src/routes/` directory (TanStack Router file-based routing)
4. **Adding UI Components**: Use shadcn CLI: `pnpx shadcn@latest add <component-name>`

## Building for Production

1. **Build the application**:
   ```bash
   pnpm build
   ```

2. **Deploy Convex** (if not using dev mode):
   ```bash
   npx convex deploy
   ```

3. **Deploy to Vercel** (or your preferred platform):
   - The project includes a `vercel.json` configuration
   - Connect your repository to Vercel
   - Set environment variables in Vercel dashboard
   - Deploy

## Project Structure

```
synapse/
├── convex/                 # Convex backend
│   ├── schema.ts          # Database schema definition
│   ├── conversations.ts   # Conversation-related functions
│   ├── nodes.ts           # Node/tree-related functions
│   └── _generated/        # Auto-generated Convex types
├── src/
│   ├── components/        # React components
│   │   ├── chat/         # Chat interface components
│   │   ├── navigation/   # Navigation components
│   │   ├── tree/         # Tree visualization components
│   │   └── ui/           # shadcn/ui components
│   ├── hooks/            # Custom React hooks
│   ├── integrations/     # Third-party integrations
│   │   ├── clerk/        # Clerk auth setup
│   │   ├── convex/       # Convex provider setup
│   │   └── tanstack-query/ # TanStack Query setup
│   ├── lib/
│   │   ├── constants/    # App constants (models, system prompt)
│   │   └── utils.ts      # Utility functions
│   ├── routes/           # TanStack Router routes
│   │   ├── __root.tsx    # Root layout
│   │   ├── index.tsx     # Home page
│   │   ├── chat.$id.tsx  # Chat conversation page
│   │   ├── tree.$id.tsx  # Tree view page
│   │   └── api.chat.ts   # Chat API endpoint
│   ├── env.ts            # Environment variable validation
│   ├── router.tsx        # Router configuration
│   └── styles.css        # Global styles
├── public/               # Static assets
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── biome.json           # Biome (linter/formatter) config
```

## Environment Variables Reference

### Server-Side Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI model access |
| `SERVER_URL` | No | Custom server URL (for production) |
| `MODEL_NAME` | No | Override default model selection |

### Client-Side Variables (prefixed with `VITE_`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Yes | Convex deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for authentication |
| `VITE_APP_TITLE` | No | Custom application title |

### AI Provider API Keys (Server-Side)

These are automatically detected by the AI SDK when using corresponding models:

- `ANTHROPIC_API_KEY` - For Anthropic/Claude models
- `GOOGLE_GENERATIVE_AI_API_KEY` - For Google/Gemini models
- `XAI_API_KEY` - For xAI/Grok models

## Troubleshooting

### Convex Connection Issues

- Ensure `VITE_CONVEX_URL` is set correctly in your `.env` file
- Run `npx convex dev` to ensure your Convex project is running
- Check that your Convex deployment is active in the dashboard

### Clerk Authentication Issues

- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
- Ensure your Clerk application is configured properly
- Check browser console for authentication errors

### API Key Issues

- Ensure `OPENAI_API_KEY` is set (required for default models)
- For other providers, ensure corresponding API keys are set when using those models
- Check that API keys have proper permissions and credits

### Build Issues

- Clear `node_modules` and reinstall: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
- Ensure Node.js version is 18 or higher
- Check that all environment variables are set before building

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and formatting (`pnpm check`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
