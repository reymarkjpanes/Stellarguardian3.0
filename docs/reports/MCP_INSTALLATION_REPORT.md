# MCP Server Installation & Configuration Report

**Project**: Stellar Guardian 3.0  
**Date**: July 19, 2026  
**Configuration File**: `.kiro/settings/mcp.json`

---

## Installed MCP Servers

| Server | Package | Version | Status |
|--------|---------|---------|--------|
| Context7 | `@upstash/context7-mcp@latest` | Latest (npx) | ✅ Active & Verified |
| Playwright | `@playwright/mcp@latest` | Latest (npx) | ✅ Active & Verified |
| BrowserTools | `@agentdeskai/browser-tools-mcp@latest` | Latest (npx) | ⚠️ Disabled (Deprecated) |
| GitHub | `ghcr.io/github/github-mcp-server` | v1.6.0 (Docker) | ✅ Active (Requires PAT) |
| Filesystem | `@modelcontextprotocol/server-filesystem@latest` | Latest (npx) | ✅ Active & Verified |

---

## Configuration Details

### Context7 (Documentation Lookup)
- **Command**: `npx -y @upstash/context7-mcp@latest`
- **Auto-approved tools**: resolve-library-id, get-library-docs, query-docs
- **Validation**: Successfully resolved React documentation library

### Playwright MCP (Browser Automation)
- **Command**: `npx -y @playwright/mcp@latest --browser chrome --caps vision,pdf`
- **Features enabled**: Vision (screenshots), PDF generation
- **Auto-approved tools**: browser_navigate, browser_snapshot, browser_take_screenshot, browser_click, browser_type, browser_tab_list, browser_tab_new, browser_tab_close
- **Validation**: Successfully navigated to https://playwright.dev and retrieved page title

### BrowserTools MCP (DevTools Integration)
- **Command**: `npx -y @agentdeskai/browser-tools-mcp@latest`
- **Status**: `disabled: true`
- **Reason**: Project is officially no longer maintained (per GitHub README). Requires Chrome extension + separate middleware server (`browser-tools-server`) running in a terminal. The Playwright MCP already provides equivalent browser inspection capabilities.
- **Auto-approved tools**: Configured for when/if enabled

### GitHub MCP (Repository Operations)
- **Command**: `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server`
- **Auth**: Requires `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable
- **Auto-approved tools**: get_file_contents, search_repositories, search_code, list_commits, get_pull_request, list_pull_requests, get_issue, list_issues
- **Validation**: Docker image pulled successfully, server starts (v1.6.0)

### Filesystem MCP (File Operations)
- **Command**: `npx -y @modelcontextprotocol/server-filesystem@latest`
- **Allowed directories**:
  - `c:/Users/Reymark/Documents/Antigravity-Project/stellar-guardian-3.0` (root)
  - `c:/Users/Reymark/Documents/Antigravity-Project/stellar-guardian-3.0/docs` (reports)
  - `c:/Users/Reymark/Documents/Antigravity-Project/stellar-guardian-3.0/web` (app code)
- **Auto-approved tools**: read_file, write_file, create_directory, list_directory, move_file, search_files, get_file_info, list_allowed_directories
- **Validation**: Successfully listed directories, created and wrote to files

---

## Prerequisites Verified

| Requirement | Version | Status |
|-------------|---------|--------|
| Node.js | v24.16.0 | ✅ |
| npx | 11.13.0 | ✅ |
| Docker | 29.5.2 | ✅ |

---

## Files Created/Modified

| File | Action |
|------|--------|
| `.kiro/settings/mcp.json` | Modified (added 4 servers) |
| `docs/reports/.gitkeep` | Created (report output directory) |
| `docs/reports/MCP_INSTALLATION_REPORT.md` | Created (this file) |

---

## Required User Actions

### GitHub MCP — Set Personal Access Token
The GitHub MCP server requires a Personal Access Token to authenticate. Set it as an environment variable:

```
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

Create a token at https://github.com/settings/personal-access-tokens/new with these scopes:
- `repo` (read access to repositories)
- `read:org` (if you need org access)

### BrowserTools MCP — Manual Setup (Optional)
If you want to enable BrowserTools MCP:
1. Set `"disabled": false` in `.kiro/settings/mcp.json`
2. Install the Chrome extension from the [releases page](https://github.com/AgentDeskAI/browser-tools-mcp/releases)
3. Run the middleware server in a separate terminal: `npx @agentdeskai/browser-tools-server@latest`

---

## Warnings

1. **BrowserTools MCP is deprecated** — The project's README explicitly states "THIS PROJECT IS NO LONGER ACTIVE." It's configured but disabled. The Playwright MCP provides superior browser automation capabilities for this project.

2. **GitHub MCP requires Docker** — Docker must be running when GitHub MCP is invoked. The Docker image (`ghcr.io/github/github-mcp-server`) has been pre-pulled.

3. **No conflicts detected** — The MCP configuration does not conflict with existing agent skills in `.agents/skills/` or steering rules in `.kiro/steering/`.

---

## Recommended Additional MCPs

| Server | Use Case | Package |
|--------|----------|---------|
| Supabase MCP | Database operations (already available as Kiro Power) | `supabase-hosted` power |
| Figma MCP | Design-to-code (already available as Kiro Power) | `figma` power |

Both are already available via Kiro Powers and don't need separate MCP configuration.

---

## Project Defaults Summary

| Task Type | Primary MCP | Fallback |
|-----------|-------------|----------|
| UI/UX review, responsive testing, screenshots | Playwright | — |
| CSS inspection, accessibility, performance | Playwright (with `--caps vision`) | BrowserTools (if enabled) |
| Repository analysis, code search, PR inspection | GitHub | — |
| Documentation lookup (React, Next.js, Tailwind, etc.) | Context7 | — |
| Report generation, file management | Filesystem | — |
| Database operations | Supabase Power | — |
| Design implementation from Figma | Figma Power | — |
