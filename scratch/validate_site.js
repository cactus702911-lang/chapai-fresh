const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
let errorCount = 0;
let warningCount = 0;

function reportError(message) {
  console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  errorCount++;
}

function reportWarning(message) {
  console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`);
  warningCount++;
}

// 1. Verify JS files syntax
const jsFiles = ['build_site.js', 'data_manager.js', 'site_data.js'];
jsFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    reportError(`Required file missing: ${file}`);
    return;
  }
  try {
    const code = fs.readFileSync(filePath, 'utf-8');
    // Basic syntax check by parsing it
    new Function(code);
    console.log(`\x1b[32m[OK]\x1b[0m Syntax check passed for: ${file}`);
  } catch (err) {
    reportError(`Syntax error in ${file}: ${err.message}`);
  }
});

// Load site_data.js to verify structures
let siteData;
try {
  siteData = require(path.join(rootDir, 'site_data.js'));
  console.log(`\x1b[32m[OK]\x1b[0m site_data.js loaded successfully.`);
} catch (err) {
  reportError(`Failed to load site_data.js: ${err.message}`);
}

// 2. Scan all HTML files
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'scratch') {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const htmlFiles = walkDir(rootDir);
console.log(`Found ${htmlFiles.length} HTML files to validate.`);

htmlFiles.forEach(filePath => {
  const relPath = path.relative(rootDir, filePath);
  const isTemplate = relPath.startsWith('templates');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 2.a. Check for unresolved placeholders in compiled HTML files (templates are allowed to have them)
  if (!isTemplate) {
    const placeholderRegex = /\{\{[A-Z0-9_]+\}\}/g;
    const matches = content.match(placeholderRegex);
    if (matches) {
      matches.forEach(m => {
        // Some placeholders might be handled in Alpine/frontend if they aren't double bracket templates
        // but double curly bracket placeholders are definitely templating placeholders.
        reportError(`Unresolved compilation placeholder '${m}' found in compiled file: ${relPath}`);
      });
    }
  }

  // 2.b. Parse tags to find asset paths and links
  // Match src="..." or href="..." but ignore alpine bindings starting with : or x-bind:
  // We match it and then check if it's dynamic.
  const linkRegex = /([\w:-]+)="([^"]+)"/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const attr = match[1];
    const url = match[2];

    // Only check src and href
    if (attr !== 'src' && attr !== 'href') {
      continue;
    }

    // Skip external links, anchors, mailto/tel, and data URIs
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('#') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('javascript:') ||
      url.startsWith('data:') ||
      url.includes('{{') || // skip placeholders in templates
      url.includes('+') || // likely dynamic JS expression
      url.startsWith('review.') ||
      url.startsWith('item.') ||
      url.includes('activeImageIdx') ||
      url === 'whatsappLink' ||
      url === 'messengerLink' ||
      url === 'newImageBase64'
    ) {
      continue;
    }

    // Strip query parameter or hash
    const cleanUrl = url.split('?')[0].split('#')[0];
    if (!cleanUrl) {
      continue;
    }

    // Resolve relative path based on file depth
    const fileDir = path.dirname(filePath);
    let resolvedPath;
    if (cleanUrl.startsWith('/')) {
      resolvedPath = path.join(rootDir, cleanUrl);
    } else {
      resolvedPath = path.resolve(fileDir, cleanUrl);
    }

    // Handle clean routes without .html (like /about, /shop, product/mango)
    let exists = fs.existsSync(resolvedPath);
    if (!exists) {
      // Try adding .html
      if (fs.existsSync(resolvedPath + '.html')) {
        exists = true;
      }
    }

    if (!exists) {
      // Check if it matches static images/reviews prefix or similar which might be dynamically saved
      // but if it is hardcoded in HTML it should exist!
      // In templates, paths are placeholders, so skip templates for absolute asset checks unless it's a fixed asset
      if (!isTemplate || cleanUrl.startsWith('images/')) {
        reportWarning(`Broken reference in ${relPath}: ${attr}="${url}" (Resolved target does not exist: ${path.relative(rootDir, resolvedPath)})`);
      }
    }
  }
});

console.log(`\nValidation complete.`);
console.log(`\x1b[32mErrors:\x1b[0m ${errorCount}`);
console.log(`\x1b[33mWarnings:\x1b[0m ${warningCount}`);

if (errorCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
