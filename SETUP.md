# 🚀 New Cnidaria Workspace Setup Guide

## Quick Setup (5 minutes)

### 1. Initial Setup
```bash
# Navigate to your workspace
cd "New Cnidaria"

# Make all scripts executable
chmod +x *.sh cnidaria

# Run the alias setup (optional but recommended)
./setup-aliases.sh
```

### 2. Test the System
```bash
# Show workspace status
./cnidaria --show

# Switch to API project
./cnidaria api

# Switch to Admin project
./cnidaria admin

# Switch to Unity project
./cnidaria unity

# Switch to shared documentation
./cnidaria docs
```

### 3. Restart Your Terminal
After running `./setup-aliases.sh`, restart your terminal to use the convenient aliases:
```bash
cnidaria-api      # Switch to API project
cnidaria-admin    # Switch to Admin project
cnidaria-unity    # Switch to Unity project
cnidaria-docs     # Switch to shared documentation
```

## 🎯 What You Get

### ✅ Project Isolation
- Each project has its own Git repository
- Automatic `.gitignore` files for each project type
- Project-specific README templates
- Clean separation of concerns

### ✅ Context Awareness
- Clear alerts when switching projects
- Repository information display
- Shared documentation status
- Git status summaries

### ✅ Easy Navigation
- Simple commands to switch projects
- Shell aliases for quick access
- VS Code workspace integration
- Consistent project structure

### ✅ Shared Resources
- Centralized documentation in `Docs/`
- Accessible from all projects via `../Docs`
- Common configuration templates
- Best practices documentation

## 🔧 Customization

### Repository Configuration
The workspace is configured with the following repositories:
```json
"repository": "https://github.com/danielcrowder/cnidaria-api.git"
"repository": "https://github.com/danielcrowder/cnidaria-admin.git"
"repository": "https://github.com/danielcrowder/cnidaria-unity.git"
```

These repositories are automatically set up when you first switch to each project.

### Add New Projects
1. Add project to `workspace.json`
2. Update `switch-project.sh` with new project type
3. Add appropriate `.gitignore` template
4. Update VS Code workspace

### Modify Project Types
Edit the `create_gitignore` function in `switch-project.sh` to add new project types with appropriate `.gitignore` files.

## 📱 Daily Usage

### Morning Routine
```bash
cnidaria              # Check workspace status
cnidaria-api          # Start working on API
```

### Switching Projects
```bash
cnidaria-admin        # Switch to Admin project
cnidaria-unity        # Switch to Unity project
cnidaria-docs         # View shared documentation
```

### Project Management
```bash
# Each project directory has its own Git repo
cd API
git status
git add .
git commit -m "Update API endpoints"

cd ../Admin
git status
git add .
git commit -m "Add new admin features"
```

## 🚨 Troubleshooting

### Scripts Not Executable
```bash
chmod +x *.sh cnidaria
```

### Aliases Not Working
```bash
# Check if aliases were added
grep "cnidaria" ~/.zshrc  # or ~/.bashrc

# Manually source your shell config
source ~/.zshrc  # or source ~/.bashrc
```

### Git Repository Issues
```bash
# Force reinitialize a project
rm -rf API/.git
./cnidaria api
```

## 🎉 You're All Set!

Your New Cnidaria workspace is now:
- ✅ Organized with clear project separation
- ✅ Git-enabled with automatic repository management
- ✅ Context-aware with clear project switching
- ✅ Integrated with VS Code for optimal development
- ✅ Equipped with convenient shell aliases
- ✅ Ready for collaborative development

**Happy coding! 🎮✨**
