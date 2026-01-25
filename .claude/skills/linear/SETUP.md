# Linear Skill Setup

## 1. Get Linear API Key

1. Go to https://linear.app/settings/api
2. Click "Create new API key"
3. Give it a name (e.g., "Claude Code")
4. Copy the key (starts with `lin_api_`)

## 2. Set Environment Variable

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export LINEAR_API_KEY="lin_api_your_key_here"
```

Then reload:
```bash
source ~/.zshrc
```

## 3. Disable Linear MCP (saves ~33k tokens)

The Linear MCP plugin is now redundant. To disable it and save context:

Option A: Add to `.claude/settings.json`:
```json
{
  "disabledMcpjsonServers": ["plugin:linear:linear"]
}
```

Option B: Run command:
```bash
claude mcp remove plugin:linear:linear
```

## 4. Test

```bash
# Test API connection
.claude/skills/linear/scripts/linear.sh teams

# Should return list of your Linear teams
```

## Troubleshooting

**Error: LINEAR_API_KEY not set**
→ Make sure you exported the key and reloaded your shell

**Error: jq not found**
→ Install jq: `brew install jq`

**Empty results**
→ Check your API key has correct permissions at Linear settings
