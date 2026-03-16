#!/bin/bash

# Simplest script using git archive to create a clean zip
# This automatically excludes .git directory and respects .gitignore

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ZIP_NAME="backend-challenge-${TIMESTAMP}.zip"

echo "🎯 Creating take-home challenge zip using git archive..."
echo "📦 Output: ${ZIP_NAME}"

# Use git archive to create a clean zip without .git directory
git archive --format=zip --output="${ZIP_NAME}" HEAD

echo "✅ Successfully created: ${ZIP_NAME}"
echo ""
echo "📊 Zip contents preview:"
unzip -l "${ZIP_NAME}" | head -20
echo "..."
echo ""
echo "💡 Note: git archive automatically excludes .git directory"
echo "🎉 Ready to distribute!"

