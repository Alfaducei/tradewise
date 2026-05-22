#!/usr/bin/env bash
# Bisection script to find which test creates unwanted files/state
# Usage: ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh '.git' 'src/**/*.test.ts'

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

# Validate inputs
if [[ "$POLLUTION_CHECK" =~ [;\|\&\$\`] ]]; then
  echo "Error: Invalid characters in pollution check path" >&2
  exit 1
fi

if [[ "$TEST_PATTERN" =~ [;\|\&\$\`] ]]; then
  echo "Error: Invalid characters in test pattern" >&2
  exit 1
fi

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Get list of test files
# Using glob expansion instead of find for better safety
shopt -s globstar nullglob
TEST_FILES_ARRAY=($TEST_PATTERN)
TOTAL=${#TEST_FILES_ARRAY[@]}

if [ $TOTAL -eq 0 ]; then
  echo "Error: No test files found matching pattern: $TEST_PATTERN" >&2
  exit 1
fi

echo "Found $TOTAL test files"
echo ""

COUNT=0
for TEST_FILE in "${TEST_FILES_ARRAY[@]}"; do
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  npm test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  npm test $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
