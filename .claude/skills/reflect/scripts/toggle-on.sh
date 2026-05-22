#!/bin/bash
# Support CLAUDE_SKILLS_DIR environment variable
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
SKILL_DIR="$CLAUDE_SKILLS_DIR/reflect"
STATE_FILE="$SKILL_DIR/.state/auto-reflection.json"

mkdir -p "$SKILL_DIR/.state"

echo "{\"enabled\": true, \"updated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATE_FILE"

echo "✓ Auto-Reflection enabled"
echo ""
echo "  Reflection runs automatically at each session end"
echo "  Analyzes corrections and suggests skill improvements"
echo ""
echo "  Disable with: /reflect-off"
echo "  Check status with: /reflect-status"
