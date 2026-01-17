const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");

// VALIDATION RULES
const ALLOWED_TOP_LEVEL = new Set(["assets", "pack.mcmeta", "animation_skip.json", "pack.png", "sprites.json"]);
const ALLOWED_EXT = new Set([
  ".png", ".json", ".mcmeta", ".ogg", ".sfk", ".wav", ".txt", ".bbmodel",
  ".tga", ".jpeg", ".jpg", ".bmp", ".fsh", ".vsh", ".glsl", ".aseprite", ".ase", ".properties", ".mp3", ".ini"
]);
const MAX_ZIP_SIZE_MB = 200;               // Max ZIP file size in MB
const MAX_ZIP_SIZE = MAX_ZIP_SIZE_MB * 1024 * 1024;
const MAX_SINGLE_FILE_MB = 50;             // Max individual file size in MB
const MAX_SINGLE_FILE = MAX_SINGLE_FILE_MB * 1024 * 1024;
const SUSPICIOUS_KEYWORDS = /\b(exec|cmd|eval|system|shell|python|js|load|run|require|process)\b/i;

// Log to errors.txt
function logError(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync("errors.txt", logMessage);
}

// Scan JSON recursively for suspicious content
function scanJson(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 50) return false;
  
  if (typeof obj === "string") {
    // Allow simple alphanumeric strings (like "shell", "egg", "base", etc.)
    // These are common in Minecraft model names
    if (/^[a-z0-9_-]+$/i.test(obj) && obj.length < 30) {
      return false; // SAFE → likely a simple identifier
    }
    
    // Allow Minecraft-style identifiers and resource paths
    // Examples: modelengine:egg/shell, minecraft:item/stick, block/stone
    const minecraftPatterns = [
      /^[a-z0-9_.-]+:[a-z0-9_.\/-]+$/i,  // namespace:path (modelengine:egg/shell)
      /^[a-z0-9_.\/-]+$/i,                 // relative path (item/shell, block/stone)
      /^#[a-z0-9_.:\/]+$/i                 // tags (#minecraft:items/tools)
    ];
    
    for (const pattern of minecraftPatterns) {
      if (pattern.test(obj)) {
        return false; // SAFE → skip suspicious keyword test
      }
    }

    // Actual malware check - only flag suspicious keywords in complex strings
    if (SUSPICIOUS_KEYWORDS.test(obj)) {
      logError(`Suspicious JSON value: "${obj}" (length: ${obj.length})`);
      return true;
    }
    return false;
  }
  
  if (Array.isArray(obj)) {
    for (const element of obj) {
      if (scanJson(element, depth + 1)) return true;
    }
    return false;
  }
  
  if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      if (scanJson(obj[key], depth + 1)) return true;
    }
    return false;
  }
  
  return false;
}

// Enhanced image validation (check magic bytes and structure)
function validateImageBytes(buffer, ext) {
  if (buffer.length < 8) {
    logError(`Image too small: ${buffer.length} bytes for ${ext}`);
    return false;
  }
  
  const magicBytes = buffer.slice(0, 12);
  
  if (ext === ".png") {
    // PNG: 89 50 4E 47 0D 0A 1A 0A (full 8-byte signature)
    if (!(magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && 
          magicBytes[2] === 0x4E && magicBytes[3] === 0x47 &&
          magicBytes[4] === 0x0D && magicBytes[5] === 0x0A &&
          magicBytes[6] === 0x1A && magicBytes[7] === 0x0A)) {
      logError(`Invalid PNG signature: ${Array.from(magicBytes.slice(0, 8)).map(b => b.toString(16)).join(' ')}`);
      return false;
    }
    // Check for IHDR chunk immediately after signature
    if (buffer.length > 12) {
      const chunkType = buffer.slice(12, 16).toString('ascii');
      if (chunkType !== 'IHDR') {
        logError(`Invalid PNG structure: expected IHDR, got ${chunkType}`);
        return false;
      }
    }
    return true;
  } else if (ext === ".jpg" || ext === ".jpeg") {
    // JPEG: FF D8 FF (start) and should end with FF D9
    if (!(magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF)) {
      logError(`Invalid JPEG signature: ${Array.from(magicBytes.slice(0, 3)).map(b => b.toString(16)).join(' ')}`);
      return false;
    }
    // Check for valid JPEG end marker
    if (buffer.length > 2) {
      const end = buffer.slice(-2);
      if (!(end[0] === 0xFF && end[1] === 0xD9)) {
        logError(`Invalid JPEG end marker: ${end[0].toString(16)} ${end[1].toString(16)}`);
        return false;
      }
    }
    return true;
  } else if (ext === ".bmp") {
    // BMP: 42 4D (BM)
    if (!(magicBytes[0] === 0x42 && magicBytes[1] === 0x4D)) {
      logError(`Invalid BMP signature`);
      return false;
    }
    // Check file size field exists and is reasonable
    if (buffer.length >= 6) {
      const fileSize = magicBytes.readUInt32LE(2);
      // File size in header should roughly match actual size
      if (fileSize > 0 && Math.abs(fileSize - buffer.length) > buffer.length * 0.1) {
        logError(`BMP file size mismatch: header says ${fileSize}, actual ${buffer.length}`);
        return false;
      }
    }
    return true;
  } else if (ext === ".tga") {
    // TGA has no magic bytes, but we can validate structure
    if (buffer.length < 18) {
      logError(`TGA file too small: ${buffer.length} bytes`);
      return false;
    }
    const imageType = magicBytes[2];
    // Valid TGA image types: 0,1,2,3,9,10,11
    if (![0,1,2,3,9,10,11].includes(imageType)) {
      logError(`Invalid TGA image type: ${imageType}`);
      return false;
    }
    return true;
  }
  
  return true;
}

// Detect polyglot files (files that are valid as multiple formats)
function detectPolyglot(buffer, ext) {
  const sigs = {
    png: [0x89, 0x50, 0x4E, 0x47],
    jpg: [0xFF, 0xD8, 0xFF],
    gif: [0x47, 0x49, 0x46],
    zip: [0x50, 0x4B, 0x03, 0x04],
    pdf: [0x25, 0x50, 0x44, 0x46],
  };

  const header = buffer.slice(0, 12);  // safer

  const matches = [];
  for (const [format, sig] of Object.entries(sigs)) {
    let ok = true;
    for (let i = 0; i < sig.length; i++) {
      if (header[i] !== sig[i]) {
        ok = false;
        break;
      }
    }
    if (ok) matches.push(format.toUpperCase());
  }

  if (matches.length > 1) {
    logError(`Polyglot detected: ${matches.join(", ")}`);
    return true;
  }

  return false;
}

// Check for embedded code in image metadata/comments
function scanImageForEmbeddedCode(buffer, ext) {
  const bufferStr = buffer.toString('binary');
  
  // Look for script tags, PHP tags, or suspicious patterns
  const dangerousPatterns = [
    /<script/i,
    /<\?php/i,
    /eval\(/i,
    /exec\(/i,
    /system\(/i,
    /passthru\(/i,
    /shell_exec/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(bufferStr)) {
      logError(`Embedded code detected matching pattern: ${pattern}`);
      return true;
    }
  }
  
  return false;
}

function validateResourcePack(zipPath) {
  try {
    logError(`\n=== Starting validation for: ${zipPath} ===`);
    
    // Check if file exists
    if (!fs.existsSync(zipPath)) {
      logError("File does not exist");
      return { valid: false, error: "File does not exist" };
    }

    // Check ZIP file size
    const stats = fs.statSync(zipPath);
    logError(`ZIP file size: ${Math.round(stats.size / 1024 / 1024)}MB`);
    if (stats.size > MAX_ZIP_SIZE) {
      logError(`ZIP too large: ${Math.round(stats.size / 1024 / 1024)}MB > ${MAX_ZIP_SIZE_MB}MB`);
      return { valid: false, error: `ZIP file too large (${Math.round(stats.size / 1024 / 1024)}MB, max ${MAX_ZIP_SIZE_MB}MB)` };
    }

    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    logError(`Total entries: ${zipEntries.length}`);

    let hasPackMcmeta = false;
    let hasAssets = false;

    // Scan every file
    for (const entry of zipEntries) {
      const entryName = entry.entryName;
      const entryNameLower = entryName.toLowerCase();

      logError(`Checking: ${entryName} (isDirectory: ${entry.isDirectory})`);

      // 1. PATH TRAVERSAL PROTECTION
      if (entryName.includes("..") || entryName.startsWith("/")) {
        logError(`FAIL: Unsafe path detected`);
        return { valid: false, error: `Unsafe path detected: ${entryName}` };
      }

      // Check top-level - only block files at root that shouldn't be there
      const parts = entryName.split("/");
      const topLevel = parts[0];
      const isRootFile = parts.length === 1 && !entry.isDirectory;
      if (isRootFile && topLevel !== "pack.mcmeta" && topLevel !== "pack.mcmeta.json" && topLevel !== "sprites.json" && topLevel !== "pack.png" && topLevel !== "animation_skip.json") {
        logError(`FAIL: Invalid root file: ${topLevel}`);
        return { valid: false, error: `Invalid root file: ${topLevel}` };
      }

      // Check for pack.mcmeta
      if (entryNameLower === "pack.mcmeta" || entryNameLower.endsWith("/pack.mcmeta")) {
        hasPackMcmeta = true;
        logError(`Found pack.mcmeta`);

        try {
          const content = entry.getData().toString("utf8");
          const json = JSON.parse(content);
          
          // Scan for suspicious content
          if (scanJson(json)) {
            logError(`FAIL: pack.mcmeta contains suspicious content`);
            return { valid: false, error: "pack.mcmeta contains suspicious content" };
          }
        } catch (err) {
          logError(`FAIL: pack.mcmeta JSON error: ${err.message}`);
          return { valid: false, error: "pack.mcmeta is not valid JSON" };
        }
      }

      // Check for assets folder
      if (entryNameLower.includes("assets/")) {
        hasAssets = true;
        logError(`Found assets folder content`);
      }

      // Skip directories
      if (entry.isDirectory) continue;

      // 2. FILE EXTENSION VALIDATION
      const ext = path.extname(entryNameLower);
      if (ext && !ALLOWED_EXT.has(ext)) {
        logError(`FAIL: File type not allowed: ${ext}`);
        return { valid: false, error: `File type not allowed: ${entryName}` };
      }

      // 3. FILE SIZE CHECK
      if (entry.header.size > MAX_SINGLE_FILE) {
        logError(`FAIL: File too large: ${Math.round(entry.header.size / 1024 / 1024)}MB`);
        return { valid: false, error: `File too large: ${entryName} (${Math.round(entry.header.size / 1024 / 1024)}MB, max ${MAX_SINGLE_FILE_MB}MB)` };
      }

      // 4. VALIDATE FILE CONTENTS
      try {
        const fileData = entry.getData();

        // Validate JSON files
        if (ext === ".json" || ext === ".mcmeta") {
          try {
            const json = JSON.parse(fileData.toString("utf8"));
            if (scanJson(json)) {
              logError(`FAIL: Suspicious content in JSON`);
              return { valid: false, error: `Suspicious content detected in ${entryName}` };
            }
          } catch (err) {
            logError(`FAIL: Invalid JSON: ${err.message}`);
            return { valid: false, error: `Invalid JSON in ${entryName}` };
          }
        }

        // Validate text files
        if (ext === ".txt" || ext === ".fsh" || ext === ".vsh") {
          const text = fileData.toString("utf8");
          if (SUSPICIOUS_KEYWORDS.test(text)) {
            logError(`FAIL: Suspicious content in text file`);
            return { valid: false, error: `Suspicious content detected in ${entryName}` };
          }
        }

        // Validate images
        if ([".png", ".jpg", ".jpeg", ".bmp", ".tga"].includes(ext)) {
          logError(`Validating image: ${entryName}`);
          if (!validateImageBytes(fileData, ext)) {
            logError(`FAIL: Image validation failed`);
            return { valid: false, error: `Invalid or corrupted image: ${entryName}` };
          }
          
          // Check for polyglot files
          //if (detectPolyglot(fileData, ext)) {
          //  logError(`FAIL: Polyglot detected`);
          //  return { valid: false, error: `Suspicious polyglot file detected: ${entryName}` };
          //}
          
          // Scan for embedded code
          if (scanImageForEmbeddedCode(fileData, ext)) {
            logError(`FAIL: Embedded code in image`);
            return { valid: false, error: `Image contains embedded code: ${entryName}` };
          }
        }
      } catch (err) {
        logError(`FAIL: Could not read file: ${err.message}`);
        return { valid: false, error: `Could not read file: ${entryName}` };
      }
    }

    // 5. REQUIRED FILES CHECK
    if (!hasPackMcmeta) {
      logError(`FAIL: Missing pack.mcmeta`);
      return { valid: false, error: "Missing pack.mcmeta file" };
    }

    if (!hasAssets) {
      logError(`FAIL: Missing assets folder`);
      return { valid: false, error: "Missing assets folder" };
    }

    logError(`SUCCESS: Pack is valid`);
    return { valid: true };
  } catch (err) {
    logError(`EXCEPTION: ${err.message}\n${err.stack}`);
    console.error("Error validating resource pack:", err);
    return { valid: false, error: "Could not read ZIP file" };
  }
}

module.exports = { validateResourcePack };

// CLI support - run directly from command line
if (require.main === module) {
  const zipPath = process.argv[2];
  
  if (!zipPath) {
    console.log('Usage: node inputzipcheck.js <zipfile>');
    console.log('Example: node inputzipcheck.js input.zip');
    process.exit(1);
  }
  
  console.log(`\nValidating: ${zipPath}\n`);
  
  const result = validateResourcePack(zipPath);
  
  console.log('\n========== RESULT ==========');
  if (result.valid) {
    console.log('✅ ZIP IS VALID');
  } else {
    console.log('❌ ZIP IS INVALID');
    console.log(`Error: ${result.error}`);
  }
  console.log('============================\n');
}