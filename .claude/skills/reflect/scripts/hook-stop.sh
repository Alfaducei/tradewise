#!/bin/bash
# Stop hook that triggers reflection when enabled

# Support CLAUDE_SKILLS_DIR environment variable
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
SKILL_DIR="$CLAUDE_SKILLS_DIR/reflect"
STATE_FILE="$SKILL_DIR/.state/auto-reflection.json"
LOCK_FILE="$SKILL_DIR/.state/reflection.lock"
LOG_FILE="${CLAUDE_REFLECT_DIR:-$HOME/.claude/reflect}/hook.log"
STATUS_FILE="$SKILL_DIR/.state/last-status"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Stop hook triggered"

# Check if auto-reflection is enabled
if [ ! -f "$STATE_FILE" ]; then
    log "State file not found, allowing stop"
    exit 0  # Not configured, allow stop
fi

ENABLED=$(cat "$STATE_FILE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('enabled', False))" 2>/dev/null)
if [ "$ENABLED" != "True" ]; then
    log "Auto-reflection disabled, allowing stop"
    exit 0  # Disabled, allow stop
fi

# Check for stale lock (>10 minutes = 600 seconds)
if [ -f "$LOCK_FILE" ]; then
    if [ "$(uname)" = "Darwin" ]; then
        # macOS
        LOCK_AGE=$(($(date +%s) - $(stat -f %m "$LOCK_FILE")))
    else
        # Linux
        LOCK_AGE=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE")))
    fi

    if [ $LOCK_AGE -lt 600 ]; then
        log "Recent lock exists (age: ${LOCK_AGE}s), skipping"
        exit 0  # Recent lock exists, skip
    fi
    log "Removing stale lock (age: ${LOCK_AGE}s)"
    rm "$LOCK_FILE"  # Remove stale lock
fi

# Create lock
touch "$LOCK_FILE"
log "Lock created"

# Get transcript path from stdin
INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('transcript_path', ''))" 2>/dev/null)

log "Transcript path: $TRANSCRIPT_PATH"

# Run reflection in background to avoid timeout
(
    log "Starting background reflection"
    export TRANSCRIPT_PATH="$TRANSCRIPT_PATH"
    export AUTO_REFLECTED="true"

    python3 "$SKILL_DIR/scripts/reflect.py" >> "$LOG_FILE" 2>&1
    REFLECT_EXIT=$?

    # Write status for user visibility
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    if [ $REFLECT_EXIT -eq 0 ]; then
        log "Reflection completed successfully"
        echo "{\"status\": \"success\", \"timestamp\": \"$TIMESTAMP\", \"message\": \"Reflection completed successfully\"}" > "$STATUS_FILE"
    else
        log "Reflection failed with exit code $REFLECT_EXIT"
        ERROR_MSG="Reflection failed (exit code $REFLECT_EXIT). Check $LOG_FILE for details."
        echo "{\"status\": \"error\", \"timestamp\": \"$TIMESTAMP\", \"exit_code\": $REFLECT_EXIT, \"message\": \"$ERROR_MSG\", \"log_file\": \"$LOG_FILE\"}" > "$STATUS_FILE"

        # Also write to a user-visible error file
        ERROR_FILE="$HOME/.claude/reflect-error.txt"
        cat > "$ERROR_FILE" << EOF
Reflection Error at $TIMESTAMP

Auto-reflection failed during background processing.
Exit code: $REFLECT_EXIT

To investigate:
1. Check the log file: cat $LOG_FILE
2. Check reflection status: /reflect-status
3. Try manual reflection: /reflect

To disable auto-reflection: /reflect-off
EOF
    fi

    rm -f "$LOCK_FILE"
    log "Lock removed"
) &

log "Background process spawned, allowing stop"

# Allow stop immediately (don't block the hook)
exit 0
