const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");

// VALIDATION RULES
const ALLOWED_TOP_LEVEL = new Set(["assets", "pack.mcmeta", "animation_skip.json", "pack.png", "sprites.json"]);
const ALLOWED_EXT = new Set([
  ".png", ".json", ".mcmeta", ".ogg", ".sfk", ".wav", ".txt", ".bbmodel",
  ".tga", ".jpeg", ".jpg", ".bmp", ".fsh", ".vsh", ".glsl", ".aseprite", ".ase", ".properties", ".mp3", ".ini", ".ttf"
]);
const MAX_ZIP_SIZE_MB = 200;               // Max ZIP file size in MB
const MAX_ZIP_SIZE = MAX_ZIP_SIZE_MB * 1024 * 1024;
const MAX_SINGLE_FILE_MB = 50;             // Max individual file size in MB
const MAX_SINGLE_FILE = MAX_SINGLE_FILE_MB * 1024 * 1024;
const SUSPICIOUS_KEYWORDS = /\b(exec|cmd|eval|system|shell|python|js|load|run|require|process)\b/i;

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
    return false;
  }
  
  const magicBytes = buffer.slice(0, 12);
  
  if (ext === ".png") {
    // PNG: 89 50 4E 47 0D 0A 1A 0A (full 8-byte signature)
    if (!(magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && 
          magicBytes[2] === 0x4E && magicBytes[3] === 0x47 &&
          magicBytes[4] === 0x0D && magicBytes[5] === 0x0A &&
          magicBytes[6] === 0x1A && magicBytes[7] === 0x0A)) {
      return false;
    }
    // Check for IHDR chunk immediately after signature
    if (buffer.length > 12) {
      const chunkType = buffer.slice(12, 16).toString('ascii');
      if (chunkType !== 'IHDR') {
        return false;
      }
    }
    return true;
  } else if (ext === ".jpg" || ext === ".jpeg") {
    // JPEG: FF D8 FF (start) and should end with FF D9
    if (!(magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF)) {
      return false;
    }
    // Check for valid JPEG end marker
    if (buffer.length > 2) {
      const end = buffer.slice(-2);
      if (!(end[0] === 0xFF && end[1] === 0xD9)) {
        return false;
      }
    }
    return true;
  } else if (ext === ".bmp") {
    // BMP: 42 4D (BM)
    if (!(magicBytes[0] === 0x42 && magicBytes[1] === 0x4D)) {
      return false;
    }
    // Check file size field exists and is reasonable
    if (buffer.length >= 6) {
      const fileSize = magicBytes.readUInt32LE(2);
      // File size in header should roughly match actual size
      if (fileSize > 0 && Math.abs(fileSize - buffer.length) > buffer.length * 0.1) {
        return false;
      }
    }
    return true;
  } else if (ext === ".tga") {
    // TGA has no magic bytes, but we can validate structure
    if (buffer.length < 18) {
      return false;
    }
    const imageType = magicBytes[2];
    // Valid TGA image types: 0,1,2,3,9,10,11
    if (![0,1,2,3,9,10,11].includes(imageType)) {
      return false;
    }
    return true;
  }
  
  return true;
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
      return true;
    }
  }
  
  return false;
}

function validateResourcePack(zipPath) {
  const errors = []; // Collect all errors
  
  try {
    // Check if file exists
    if (!fs.existsSync(zipPath)) {
      errors.push("File does not exist");
      return { valid: false, errors: errors };
    }

    // Check ZIP file size
    const stats = fs.statSync(zipPath);
    if (stats.size > MAX_ZIP_SIZE) {
      errors.push(`ZIP file too large (${Math.round(stats.size / 1024 / 1024)}MB, max ${MAX_ZIP_SIZE_MB}MB)`);
      return { valid: false, errors: errors };
    }

    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    let hasPackMcmeta = false;
    let hasAssets = false;

    // Scan every file
    for (const entry of zipEntries) {
      const entryName = entry.entryName;
      const entryNameLower = entryName.toLowerCase();

      // 1. PATH TRAVERSAL PROTECTION
      if (entryName.includes("..") || entryName.startsWith("/")) {
        errors.push(`Unsafe path detected: ${entryName}`);
        continue;
      }

      // Check top-level - only block files at root that shouldn't be there
      const parts = entryName.split("/");
      const topLevel = parts[0];
      const isRootFile = parts.length === 1 && !entry.isDirectory;
      if (isRootFile && topLevel !== "pack.mcmeta" && topLevel !== "pack.mcmeta.json" && topLevel !== "sprites.json" && topLevel !== "pack.png" && topLevel !== "animation_skip.json") {
        errors.push(`Invalid root file: ${topLevel}`);
        continue;
      }

      // Check for pack.mcmeta
      if (entryNameLower === "pack.mcmeta" || entryNameLower.endsWith("/pack.mcmeta")) {
        hasPackMcmeta = true;

        try {
          const content = entry.getData().toString("utf8");
          const json = JSON.parse(content);
          
          // Scan for suspicious content
          if (scanJson(json)) {
            errors.push("pack.mcmeta contains suspicious content");
          }
        } catch (err) {
          errors.push(`pack.mcmeta is not valid JSON: ${err.message}`);
        }
      }

      // Check for assets folder
      if (entryNameLower.includes("assets/")) {
        hasAssets = true;
      }

      // Skip directories
      if (entry.isDirectory) continue;

      // 2. FILE EXTENSION VALIDATION
      const ext = path.extname(entryNameLower);
      if (ext && !ALLOWED_EXT.has(ext)) {
        errors.push(`File type not allowed: ${entryName}`);
        continue;
      }

      // 3. FILE SIZE CHECK
      if (entry.header.size > MAX_SINGLE_FILE) {
        errors.push(`File too large: ${entryName} (${Math.round(entry.header.size / 1024 / 1024)}MB, max ${MAX_SINGLE_FILE_MB}MB)`);
        continue;
      }

      // 4. VALIDATE FILE CONTENTS
      try {
        const fileData = entry.getData();

        // Validate JSON files
        if (ext === ".json" || ext === ".mcmeta") {
          try {
            const json = JSON.parse(fileData.toString("utf8"));
            if (scanJson(json)) {
              errors.push(`Suspicious content detected in ${entryName}`);
            }
          } catch (err) {
            errors.push(`Invalid JSON in ${entryName}: ${err.message}`);
          }
        }

        // Validate text files
        if (ext === ".txt" || ext === ".fsh" || ext === ".vsh") {
          const text = fileData.toString("utf8");
          if (SUSPICIOUS_KEYWORDS.test(text)) {
            errors.push(`Suspicious content detected in ${entryName}`);
          }
        }

        // Validate images
        if ([".png", ".jpg", ".jpeg", ".bmp", ".tga"].includes(ext)) {
          if (!validateImageBytes(fileData, ext)) {
            errors.push(`Invalid or corrupted image: ${entryName}`);
          }
          
          // Scan for embedded code
          if (scanImageForEmbeddedCode(fileData, ext)) {
            errors.push(`Image contains embedded code: ${entryName}`);
          }
        }
      } catch (err) {
        errors.push(`Could not read file: ${entryName}`);
      }
    }

    // 5. REQUIRED FILES CHECK
    if (!hasPackMcmeta) {
      errors.push("Missing pack.mcmeta file");
    }

    if (!hasAssets) {
      errors.push("Missing assets folder");
    }

    // Return result
    if (errors.length > 0) {
      return { valid: false, errors: errors };
    }
    
    return { valid: true, errors: [] };
  } catch (err) {
    errors.push(`Could not read ZIP file: ${err.message}`);
    return { valid: false, errors: errors };
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
  
  console.log(`Validating: ${zipPath}`);
  
  const result = validateResourcePack(zipPath);
  
  console.log('========== RESULT ==========');
  if (result.valid) {
    console.log('✅ ZIP IS VALID');
    console.log('============================');
    //process.exit(0);
  } else {
    console.log('❌ ZIP IS INVALID');
    result.errors.forEach(error => {
      console.log(`Error: ${error}`);
    });
    console.log('============================');
    //process.exit(1);
  }
}
