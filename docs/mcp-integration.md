# MCP Integration

The anki-cloud MCP server exposes 8 tools to LLMs, allowing them to manage your Anki decks and notes directly.

## Tools

| Tool                | Description                            |
|---------------------|----------------------------------------|
| `list_decks`        | List all decks with IDs and names      |
| `get_deck`          | Get a specific deck by ID              |
| `create_deck`       | Create a new deck                      |
| `create_note`       | Add a single flashcard to a deck       |
| `create_notes_bulk` | Add multiple flashcards in one request |
| `search_notes`      | Search notes using Anki search syntax  |
| `update_note`       | Edit a note's fields and tags          |
| `delete_note`       | Permanently delete a note              |

## Prerequisites

1. A running anki-cloud instance (local or hosted)
2. An API key — generate one in the web UI under **Account → API Keys**
3. [Bun](https://bun.sh) installed locally (for Claude Desktop stdio mode)

## Claude Desktop Setup

Claude Desktop connects to the MCP server via stdio. Add the following to your Claude Desktop config:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anki-cloud": {
      "command": "bun",
      "args": [
        "run",
        "/path/to/anki-cloud/mcp/src/index.ts"
      ],
      "env": {
        "API_URL": "http://localhost:3000",
        "API_KEY": "ak_your_key_here"
      }
    }
  }
}
```

Replace `/path/to/anki-cloud` with the absolute path to your clone, and `ak_your_key_here` with your API key.

For a hosted instance:

```json
{
  "mcpServers": {
    "anki-cloud": {
      "command": "bun",
      "args": [
        "run",
        "/path/to/anki-cloud/mcp/src/index.ts"
      ],
      "env": {
        "API_URL": "https://your-anki-cloud-instance.com",
        "API_KEY": "ak_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after saving the config. You should see "anki-cloud" appear in the MCP tools panel.

## Verifying the Connection

Ask Claude: _"List my Anki decks"_ — it will call `list_decks` and show the results.

## Example Prompts

- _"Create a deck called 'Python' and add 5 flashcards covering list comprehensions"_
- _"Search my notes for tag:python and update the ones about decorators"_
- _"Add these flashcards to my Spanish deck: [paste content]"_

## Docker Deployment (HTTP mode)

To run the MCP server as a networked service alongside the full stack:

```bash
MCP_API_KEY=ak_your_key docker compose up mcp
```

The server listens on port 3001. Note: in Docker mode the server uses stdio transport inside the container — you'd need to adapt `src/index.ts` to use `StreamableHTTPServerTransport` from the MCP SDK for true network
exposure.

## Environment Variables

| Variable  | Default                 | Description                         |
|-----------|-------------------------|-------------------------------------|
| `API_URL` | `http://localhost:3000` | Base URL of the anki-cloud REST API |
| `API_KEY` | _(required)_            | API key with `ak_` prefix           |
