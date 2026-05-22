#!/bin/bash
# Support CLAUDE_SKILLS_DIR environment variable
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
SKILL_DIR="$CLAUDE_SKILLS_DIR/reflect"
STATE_FILE="$SKILL_DIR/.state/auto-reflection.json"

mkdir -p "$SKILL_DIR/.state"

echo "{\"enabled\": false, \"updated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATE_FILE"

echo "✓ Auto-Reflection disabled"
echo ""
echo "  Manual reflection still available with: /reflect"
echo "  Re-enable with: /reflect-on"
echo ""
echo "  All skills remain unchanged."
