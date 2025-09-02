#!/usr/bin/env bash
set -u
RED(){ printf "\033[31m✖ %s\033[0m\n" "$*"; }
GRN(){ printf "\033[32m✔ %s\033[0m\n" "$*"; }
YEL(){ printf "\033[33m● %s\033[0m\n" "$*"; }

project_root="$(pwd)"

echo "== CHECK: mac arch =="
arch_name="$(uname -m 2>/dev/null || echo '?')"
echo "arch: $arch_name"
if [ "$arch_name" != "arm64" ]; then RED "Not arm64. Make sure you're not under Rosetta."; else GRN "arm64 OK"; fi

echo "== CHECK: Terminal not under Rosetta =="
if /usr/sbin/sysctl -n sysctl.proc_translated 2>/dev/null | grep -q 1; then
  RED "Rosetta detected. Quit Terminal, Get Info → uncheck 'Open using Rosetta'."
else
  GRN "Native arm64 Terminal"
fi

echo "== CHECK: Homebrew on PATH =="
if /opt/homebrew/bin/brew --version >/dev/null 2>&1; then
  GRN "Homebrew OK"
else
  RED "Homebrew not found at /opt/homebrew. Install Homebrew for Apple-silicon."
fi

echo "== CHECK: ~/.zprofile & ~/.zshrc for smart quotes/dashes =="
bad=0
for f in "$HOME/.zprofile" "$HOME/.zshrc"; do
  [ -f "$f" ] || continue
  if LC_ALL=C grep -n $'\xE2\x80\x98' "$f" >/dev/null 2>&1 || \
     LC_ALL=C grep -n $'\xE2\x80\x99' "$f" >/dev/null 2>&1 || \
     LC_ALL=C grep -n $'\xE2\x80\x9C' "$f" >/dev/null 2>&1 || \
     LC_ALL=C grep -n $'\xE2\x80\x9D' "$f" >/dev/null 2>&1 || \
     LC_ALL=C grep -n $'\xE2\x80\x93' "$f" >/dev/null 2>&1 || \
     LC_ALL=C grep -n $'\xE2\x80\x94' "$f" >/dev/null 2>&1 ; then
    RED "Smart quotes/dashes found in $f"
    bad=1
  else
    GRN "$f clean"
  fi
done
[ $bad -eq 1 ] && YEL "Run the sanitize fix we used earlier to replace curly quotes."

echo "== CHECK: fnm present and hooked =="
if command -v fnm >/dev/null 2>&1; then
  GRN "fnm installed"
else
  RED "fnm missing (brew install fnm)"
fi
if grep -q 'fnm env --use-on-cd' "$HOME/.zshrc" 2>/dev/null; then
  GRN "fnm init line present in ~/.zshrc"
else
  YEL "fnm init not found in ~/.zshrc (add: eval \"\$(fnm env --use-on-cd)\")"
fi

echo "== CHECK: Node on PATH, version, and arch =="
if command -v node >/dev/null 2>&1; then
  node_path="$(which node)"
  node_ver="$(node -v 2>/dev/null || echo '?')"
  node_arch="$(node -p "process.arch + ' ' + process.platform" 2>/dev/null || echo '?')"
  file_out="$(file "$node_path" 2>/dev/null || echo '?')"
  echo "node: $node_path"
  echo "version: $node_ver"
  echo "arch: $node_arch"
  echo "file: $file_out"
  if echo "$node_arch" | grep -q "arm64 darwin" && echo "$file_out" | grep -q "arm64"; then
    GRN "Node arm64 OK"
  else
    RED "Node not arm64. Use: fnm install --lts && fnm use 22.x && fnm default 22.x"
  fi
else
  RED "Node not found on PATH"
fi

echo "== CHECK: Corepack & pnpm =="
if command -v corepack >/dev/null 2>&1; then
  GRN "Corepack present"
else
  YEL "Corepack missing (need Node >=16.10). After fnm LTS: corepack enable"
fi
if command -v pnpm >/dev/null 2>&1; then
  pnpm -v | awk '{print "pnpm v"$0}' 
  GRN "pnpm OK"
else
  YEL "pnpm not found. Run: corepack enable && corepack prepare pnpm@latest --activate"
fi

echo "== CHECK: package.json validity =="
if [ -f "$project_root/package.json" ]; then
  node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" 2>/dev/null \
    && GRN "package.json is valid JSON" \
    || RED "Invalid package.json (fix JSON syntax)"
else
  RED "package.json not found in $(pwd)"
fi

echo "== CHECK: Vite script present =="
if [ -f "$project_root/package.json" ]; then
  node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts.dev==='vite'?0:1)" \
    && GRN "scripts.dev exists and runs 'vite'" \
    || YEL "No 'dev': 'vite' script detected. Ensure package.json has it."
fi

echo "== CHECK: Vite port availability (5173) =="
if lsof -i :5173 >/dev/null 2>&1; then
  YEL "Port 5173 is in use"
else
  GRN "Port 5173 free"
fi

echo "== CHECK: Quick React TS syntax probe (optional) =="
if [ -d "$project_root/src" ]; then
  # Bail-fast probe: look for obvious 'return' at top-level (very loose heuristic)
  if grep -RIn "^\s*return\s*(" "$project_root/src" | head -n 1 >/dev/null 2>&1; then
    YEL "Found a 'return (' that might be top-level; if Vite errors, check braces near that line."
  else
    GRN "No obvious top-level 'return (' found"
  fi
else
  YEL "No src/ directory found"
fi

echo "== SUMMARY =="
echo "If any ✖ appeared, fix them before opening Cursor."
echo "Open Cursor by 'File → Open Folder' at: $project_root"
