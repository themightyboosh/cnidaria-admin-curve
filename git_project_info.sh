#!/usr/bin/env bash

# Only run if this directory is a git repo
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  project_name=$(basename "$(pwd)")
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  remote=$(git remote get-url origin 2>/dev/null || echo "no remote")

  echo ""
  echo "📦 Project: $project_name"
  echo "🌿 Branch:  $branch"
  echo "🔗 Remote:  $remote"

  if command -v node >/dev/null 2>&1; then
    echo "⬢ Node:    $(node -v) ($(node -p "process.arch"))"
  fi
  if command -v pnpm >/dev/null 2>&1; then
    echo "📦 pnpm:    $(pnpm -v)"
  fi
  echo ""
fi