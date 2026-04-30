#!/bin/bash
# ══════════════════════════════════════════════════════════════
# CourtIQ — Post-session cleanup script
# Run from the CourtIQ root directory: bash cleanup.sh
# ══════════════════════════════════════════════════════════════

set -e
echo "🏀 CourtIQ Cleanup Script"
echo "========================="

# ── Step 1: Fix corrupted git index ──────────────────────────
echo ""
echo "Step 1: Fixing git index..."
rm -f .git/index.lock .git/config.lock
git reset HEAD  # Rebuild the index from HEAD
echo "✓ Git index rebuilt"

# ── Step 2: Untrack files that should be gitignored ──────────
echo ""
echo "Step 2: Untracking large/sensitive files..."
git rm --cached -r tools/training-videos/ 2>/dev/null || true
git rm --cached -r training/ 2>/dev/null || true
git rm --cached -r training_data/ 2>/dev/null || true
git rm --cached -r models/ 2>/dev/null || true
git rm --cached -r www/models/ 2>/dev/null || true
git rm --cached Download.mp4 2>/dev/null || true
git rm --cached debug-shot-tracker.html 2>/dev/null || true
echo "✓ Large files untracked (still on disk, just not in git)"

# ── Step 3: Remove dead files ────────────────────────────────
echo ""
echo "Step 3: Removing dead/debug files..."
rm -f debug-shot-tracker.html
rm -f .github/test.txt
rm -f www/UI_AUDIT_REPORT.md
rm -f index.html  # Replaced by dashboard.html
echo "✓ Dead files removed"

# ── Step 4: Verify all references ────────────────────────────
echo ""
echo "Step 4: Verifying file references in dashboard.html..."
MISSING=0
for f in $(grep -oE 'src="[^"]+\.js[^"]*"' dashboard.html | sed 's/src="//;s/"//'); do
  base="${f%%\?*}"
  case "$base" in http*) continue;; esac
  if [ ! -f "$base" ]; then
    echo "  ⚠ MISSING JS: $base"
    MISSING=$((MISSING + 1))
  fi
done
for f in $(grep -oE 'href="[^"]+\.css[^"]*"' dashboard.html | sed 's/href="//;s/"//'); do
  base="${f%%\?*}"
  if [ ! -f "$base" ]; then
    echo "  ⚠ MISSING CSS: $base"
    MISSING=$((MISSING + 1))
  fi
done
if [ $MISSING -eq 0 ]; then
  echo "✓ All references valid"
else
  echo "⚠ $MISSING missing references found"
fi

# ── Step 5: Commit everything ────────────────────────────────
echo ""
echo "Step 5: Committing cleanup..."
git add -A
git status --short
echo ""
read -p "Commit and push? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git commit -m "chore: cleanup — fix gitignore, sync source/www, remove dead files"
  git push origin master
  echo "✓ Pushed to master"
else
  echo "Skipped commit. Run 'git commit' manually when ready."
fi

echo ""
echo "✅ Cleanup complete!"
