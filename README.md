# SMC Resource Pack Validator v1.0.0

A modern, glassmorphism-styled GUI application for validating Minecraft resource pack ZIP files with security checks and structure validation.

## Installation

### Prerequisites (REQUIRED)

Before running the validator, you **must** install:

1. **Node.js** - [Download here](https://nodejs.org/) (LTS version recommended)
2. **adm-zip package** - After installing Node.js, open Command Prompt or Terminal and run:
```bash
   npm install -g adm-zip
```

### Running the Validator

1. Download `ResourcePackValidator.exe` from this release
2. Double-click to run
3. Drag & drop your resource pack ZIP or click "Browse Files"
4. Click "Validate Pack"

## Common Issues

**Error: "Cannot find module 'adm-zip'"**
- Solution: Run `npm install -g adm-zip` in your terminal
- Make sure Node.js is properly installed first

**Validation window closes immediately**
- Solution: Install both Node.js and adm-zip as listed above
- Restart your computer after installation

## Features

- Modern glassmorphism UI with gradient backgrounds
- Drag & drop support for easy file selection
- Comprehensive validation (pack.mcmeta, file structure, security checks)
- Real-time validation logs
- Fast and lightweight

## What It Checks

- Valid pack.mcmeta file and JSON structure
- Presence of pack.png icon
- Suspicious or dangerous file types
- Overall ZIP file integrity

---

**Created by SayMC** | [Report Issues on Discord](https://discord.gg/KwfDra3Pum)
