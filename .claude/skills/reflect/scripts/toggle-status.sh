#!/bin/bash
# Support CLAUDE_SKILLS_DIR environment variable
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
SKILL_DIR="$CLAUDE_SKILLS_DIR/reflect"
STATE_FILE="$SKILL_DIR/.state/auto-reflection.json"
TIMESTAMP_FILE="$SKILL_DIR/.state/last-reflection.timestamp"
STATUS_FILE="$SKILL_DIR/.state/last-status"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "                    REFLECTION STATUS"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ ! -f "$STATE_FILE" ]; then
    echo "Status:        Not configured"
    echo "Mode:          Manual"
    echo ""
    echo "Enable with: /reflect-on"
    echo "═══════════════════════════════════════════════════════════"
    exit 0
fi

ENABLED=$(cat "$STATE_FILE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('enabled', False))" 2>/dev/null)
UPDATED=$(cat "$STATE_FILE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('updated', 'unknown'))" 2>/dev/null)

if [ "$ENABLED" = "True" ]; then
    echo "Status:        ✓ Enabled"
    echo "Mode:          Automatic (at session end)"
else
    echo "Status:        ⊘ Disabled"
    echo "Mode:          Manual only"
fi

echo "Configured:    $UPDATED"

if [ -f "$TIMESTAMP_FILE" ]; then
    LAST_REFLECTION=$(cat "$TIMESTAMP_FILE" 2>/dev/null || echo "never")
    echo "Last Analysis: $LAST_REFLECTION"
fi

# Show last status if available
if [ -f "$STATUS_FILE" ]; then
    LAST_STATUS=$(cat "$STATUS_FILE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('status', 'unknown'))" 2>/dev/null)
    if [ "$LAST_STATUS" = "error" ]; then
        ERROR_MSG=$(cat "$STATUS_FILE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('message', 'Unknown error'))" 2>/dev/null)
        echo "Last Status:   ✗ Error"
        echo "Error:         $ERROR_MSG"
    elif [ "$LAST_STATUS" = "success" ]; then
        echo "Last Status:   ✓ Success"
    fi
fi

echo ""
echo "───────────────────────────────────────────────────────────"
echo "Commands:"
echo "  /reflect           - Manual analysis of current session"
echo "  /reflect-on        - Enable auto-reflection"
echo "  /reflect-off       - Disable auto-reflection"
echo "  /reflect-status    - Show status (this command)"
echo ""
echo "How it works:"
echo "  • Detects corrections in conversations (HIGH confidence)"
echo "  • Identifies successful patterns (MEDIUM confidence)"
echo "  • Notes considerations (LOW confidence)"
echo "  • Proposes skill updates with diff view"
echo "  • Commits approved changes to Git"
echo "═══════════════════════════════════════════════════════════"
echo ""
