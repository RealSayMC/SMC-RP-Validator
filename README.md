# SMC Resource Pack Validator v1.0.0

A modern, glassmorphism-styled validator for Minecraft resource pack ZIP files with security checks and structure validation.

> ⚠️ **Temporary Notice:**  
> The GUI executable is currently unavailable while a bug is being fixed.  
> Please use the Node.js script below in the meantime.

## Installation

### Prerequisites (REQUIRED)

Before running the validator, you **must** install:

1. **Node.js** - [Download here](https://nodejs.org/) (LTS version recommended)  
2. **adm-zip package** - After installing Node.js, open Command Prompt or Terminal and run:
```bash
npm install -g adm-zip
```

### Running the Validator

1. Download or clone this repository  
2. Open Command Prompt or Terminal in the folder containing `inputzipcheck.js`  
3. Run the validator using:
```bash
node inputzipcheck.js example.zip
```
Replace `example.zip` with your resource pack ZIP file.

## Common Issues

**Error: "Cannot find module 'adm-zip'"**
- Solution: Run `npm install -g adm-zip` in your terminal
- Make sure Node.js is properly installed first

**Command not recognized: node**
- Solution: Reinstall Node.js and restart your computer

## Features

- Fast and lightweight ZIP validation
- Validates Minecraft resource pack structure
- Checks for missing or invalid `pack.mcmeta`
- Detects suspicious or dangerous file types
- Clear terminal-based validation output

## What It Checks

- Valid `pack.mcmeta` file and JSON structure
- Presence of `pack.png` icon
- Suspicious or dangerous file types
- Overall ZIP file integrity

---

**Created by SayMC** | [Report Issues on Discord](https://discord.gg/KwfDra3Pum)
