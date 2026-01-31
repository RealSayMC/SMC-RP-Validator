# SMC Resource Pack Validator v1.0.0

A modern, glassmorphism-styled validator for Minecraft resource pack ZIP files, built to detect structural issues and potential security risks before uploading or distributing packs.

This tool includes both:

- A full GUI executable validator  
- A Node.js script version for terminal usage  

---

## Installation

### Option 1: GUI Executable (Recommended)

1. Download the latest release from this repository  
2. Run the validator executable  
3. Select a resource pack ZIP file to validate  

**No Node.js required for the GUI version.**

---

### Option 2: Node.js Script Version

#### Prerequisites (Required)

To run the validator through Node.js, install:

1. **Node.js**  
   Download the latest LTS version here:  
   https://nodejs.org/

2. **adm-zip package**  
   After installing Node.js, open Command Prompt or Terminal and run:

    npm install -g adm-zip

---

## Running the Validator (Node.js)

1. Download or clone this repository  
2. Open a terminal inside the folder containing `inputzipcheck.js`  
3. Run the validator with:

    node inputzipcheck.js example.zip

Replace `example.zip` with your resource pack ZIP file.

> You can run **any resource pack ZIP** this way to validate it through the terminal.

---

## Features

- Fast and lightweight ZIP validation  
- Validates Minecraft resource pack structure  
- Checks for missing or invalid `pack.mcmeta`  
- Detects suspicious or dangerous file types  
- Clear validation output (GUI + terminal)  

---

## What It Checks

- ZIP file integrity  
- Valid `pack.mcmeta` file and JSON structure  
- Presence of `pack.png` icon  
- Suspicious or dangerous file types  
- Overall pack safety before use  

---

## Common Issues (Node.js)

### Error: Cannot find module `adm-zip`

Run:

    npm install -g adm-zip

---

### Command not recognized: node

- Reinstall Node.js  
- Restart your computer after installation  

---

## Credits

**Created by SayMC**  

Report Issues or Suggestions:  
https://discord.gg/KwfDra3Pum
