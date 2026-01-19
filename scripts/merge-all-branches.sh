#!/bin/bash

# Supply Chain Guardian - Automatic Branch Merge Script
# Merges all teammate branches into integration branch and pushes changes
# Usage: ./merge-all-branches.sh [--dry-run] [--branch BRANCH_NAME]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INTEGRATION_BRANCH="integration/all-branches-merge-$(date +%Y%m%d)"
TEAMMATE_BRANCHES=("abhishek" "prashuna" "sanjit" "threatPackages" "pranay")
DRY_RUN=false
CUSTOM_BRANCH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --branch)
      CUSTOM_BRANCH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Use custom branch if provided
if [ -n "$CUSTOM_BRANCH" ]; then
  INTEGRATION_BRANCH="$CUSTOM_BRANCH"
fi

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if repo exists
if [ ! -d ".git" ]; then
  log_error "Not a git repository. Please run from the root of your git repo."
  exit 1
fi

log_info "Starting automatic branch merge workflow..."
log_info "Integration branch: $INTEGRATION_BRANCH"

# Step 1: Fetch all remotes
log_info "Step 1: Fetching all remotes..."
git fetch --all --prune
log_success "Fetch completed"

# Step 2: Ensure integration branch exists
log_info "Step 2: Ensuring integration branch exists..."
if git show-ref --verify --quiet refs/heads/$INTEGRATION_BRANCH; then
  log_warn "Integration branch already exists locally. Switching to it."
  git switch $INTEGRATION_BRANCH
else
  if git show-ref --verify --quiet refs/remotes/origin/$INTEGRATION_BRANCH; then
    log_info "Creating local tracking branch from origin/$INTEGRATION_BRANCH..."
    git switch -c $INTEGRATION_BRANCH origin/$INTEGRATION_BRANCH
  else
    log_info "Creating new integration branch from origin/main..."
    git switch -c $INTEGRATION_BRANCH origin/main
  fi
fi
log_success "Integration branch ready: $INTEGRATION_BRANCH"

# Step 3: Check for new commits in teammate branches
log_info "Step 3: Checking for new commits in teammate branches..."
echo ""

NEW_COMMITS_FOUND=false
BRANCHES_TO_MERGE=()

for branch in "${TEAMMATE_BRANCHES[@]}"; do
  REMOTE_BRANCH="origin/$branch"
  
  if git show-ref --verify --quiet refs/remotes/$REMOTE_BRANCH; then
    # Count commits
    NEW_COUNT=$(git log --oneline $INTEGRATION_BRANCH..$REMOTE_BRANCH 2>/dev/null | wc -l)
    
    if [ "$NEW_COUNT" -gt 0 ]; then
      NEW_COMMITS_FOUND=true
      BRANCHES_TO_MERGE+=("$REMOTE_BRANCH")
      log_warn "$branch: $NEW_COUNT new commit(s)"
      git log --oneline $INTEGRATION_BRANCH..$REMOTE_BRANCH | sed 's/^/  /'
    else
      log_success "$branch: up to date"
    fi
  else
    log_warn "$branch: remote branch not found"
  fi
done

echo ""

# Step 4: Merge new commits
if [ "$NEW_COMMITS_FOUND" = true ]; then
  log_info "Step 4: Merging new commits..."
  
  for branch in "${BRANCHES_TO_MERGE[@]}"; do
    log_info "Merging $branch..."
    
    if [ "$DRY_RUN" = true ]; then
      log_warn "DRY RUN: Would merge $branch"
    else
      if git merge -X theirs --no-edit "$branch" 2>/dev/null; then
        log_success "Successfully merged $branch"
      else
        log_error "Conflict while merging $branch"
        log_info "Resolving with -X theirs strategy..."
        git checkout --theirs .
        git add .
        git commit --no-edit -m "Merge $branch (resolved conflicts)"
        log_success "Merged $branch (conflicts resolved)"
      fi
    fi
  done
else
  log_info "Step 4: No new commits found in teammate branches"
fi

# Step 5: Push changes
log_info "Step 5: Pushing changes to origin..."

if [ "$DRY_RUN" = true ]; then
  log_warn "DRY RUN: Would push to origin/$INTEGRATION_BRANCH"
  log_info "Current commits:"
  git log --oneline origin/$INTEGRATION_BRANCH..$INTEGRATION_BRANCH | head -10
else
  if git push -u origin $INTEGRATION_BRANCH 2>/dev/null; then
    log_success "Pushed $INTEGRATION_BRANCH to origin"
  else
    log_error "Failed to push. Checking status..."
    git status
    exit 1
  fi
fi

# Step 6: Summary
echo ""
log_success "Workflow completed!"
log_info "Integration branch: $INTEGRATION_BRANCH"
log_info "Current HEAD:"
git log --oneline -1 --decorate

echo ""
log_info "Next steps:"
echo "  1. Review changes: git diff origin/main..$INTEGRATION_BRANCH --stat"
echo "  2. Create PR: https://github.com/Abhishek-Adhikari-1/supply-chain-detection/pull/new/$INTEGRATION_BRANCH"
echo "  3. Run tests: ./sandbox/test_all.sh (if available)"
