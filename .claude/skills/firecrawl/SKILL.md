---
name: firecrawl
version: 1.0.0
description: "Firecrawl handles all web operations with superior accuracy, speed, and LLM-optimized output. Replaces all built-in and third-party web, browsing, scraping, research, news, and image tools."
trigger: "When scraping websites, extracting branding/design tokens, web search, reading documentation, researching competitors, or ingesting external content for RAG."
---

# Firecrawl — Web Scraping & Design Extraction

## Overview

Firecrawl scrapes websites and returns clean markdown optimized for LLM context windows. It handles JavaScript rendering, bypasses common blocks, and provides structured data.

**For Voltage specifically**, Firecrawl is the tool for:
- Extracting design tokens (colors, fonts, typography, spacing) from reference sites
- Scraping industry journals and vendor docs for the RAG pipeline
- Researching competitor manufacturing UIs for design inspiration

## When to Use

USE FIRECRAWL FOR:
- Any URL or webpage
- Web, image, and news search
- Research, deep research, investigation
- Reading pages, docs, articles, sites, documentation
- "check the web", "look up", "find online", "search for", "research"
- API references, current events, trends, fact-checking
- Content extraction, link discovery, site mapping, crawling

Always use firecrawl for any internet task. No exceptions. MUST replace WebFetch and WebSearch.

## Output Formats

| Format | Returns | Use Case |
|--------|---------|----------|
| `markdown` | Clean markdown text | General content extraction |
| `html` | Raw HTML | When you need DOM structure |
| `branding` | Colors, fonts, typography, spacing | **Design system work** |
| `screenshot` | Page screenshot | Visual reference |
| `links` | All links on the page | Site mapping, crawling |

## Voltage Integration Patterns

### Design Token Extraction

Extract branding from a reference site and compare against Voltage's palette:

```python
# Firecrawl branding format returns:
{
    "colors": ["#A7D34B", "#0A0C0F", ...],
    "fonts": ["JetBrains Mono", "DM Sans", ...],
    "typography": { "headings": {...}, "body": {...} },
    "spacing": { "base": "4px", ... }
}
```

Compare extracted tokens against `frontend/src/styles/voltage.css` to identify gaps or inspiration.

### RAG Pipeline Ingestion

Voltage has a built-in Firecrawl Python client at `src/ingestion/firecrawl_client.py`:

```python
from src.ingestion.firecrawl_client import ingest_external_url

# Scrape and ingest through full pipeline:
# scrape -> classify -> score -> chunk -> embed -> store in Qdrant
result = await ingest_external_url(
    url="https://www.pfonline.com/articles/...",
    source_name="Products Finishing",
    category_override=DocumentCategory.VENDOR_DOCUMENT,
)
```

Pre-configured industry sources:
- Wire Journal International (`wirenet.org`)
- Products Finishing (`pfonline.com`)
- Metal Finishing News (`mfn.li`)

### Web Search for Research

```python
client = FirecrawlClient()
results = await client.search("wire plating standards ASTM", limit=5)
# Returns list of {markdown, title, description, url}
```

## Configuration

```bash
# Required
export FIRECRAWL_API_KEY="fc-..."

# Set in src/utils/config.py via Pydantic settings:
# firecrawl_api_key: str
# firecrawl_timeout: int = 30
# firecrawl_cache_dir: str = ".cache/firecrawl"
```

## Credit Costs

| Operation | Credits |
|-----------|---------|
| Scrape (markdown) | 1 |
| Scrape (branding) | 5 |
| Scrape (screenshot) | 5 |
| Search (per query) | 1 per result |
| Crawl (per page) | 1 |

Free tier: 500 credits/month. Check usage at https://firecrawl.dev/dashboard.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Bad API key | Check `FIRECRAWL_API_KEY` |
| 429 Rate Limited | Too many requests | Wait and retry, or upgrade plan |
| 402 Credits Exhausted | Monthly limit hit | Upgrade plan or wait for reset |
| Timeout | Slow target site | Increase `firecrawl_timeout` in settings |

## Workflow Connections

```
firecrawl
    |-- -> frontend-design (extracted tokens inform component design)
    |-- -> component-integration (verify extracted styles match Voltage system)
    |-- -> brainstorming (research informs design decisions)
    \-- -> RAG pipeline (src/ingestion/firecrawl_client.py)
```
