const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
let errors = 0;

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
console.log(`Checking scripts in ${htmlFiles.length} HTML files...`);

htmlFiles.forEach(filePath => {
  const relPath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Simple regex to extract <script>...</script> content (excluding src scripts)
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 1;

  while ((match = scriptRegex.exec(content)) !== null) {
    const scriptTag = match[0];
    const scriptContent = match[1].trim();

    // Skip scripts that load external libraries (they have src attribute and empty/no inline content)
    if (scriptTag.toLowerCase().includes(' src=') && !scriptContent) {
      continue;
    }

    if (!scriptContent) {
      continue;
    }

    try {
      if (scriptTag.toLowerCase().includes('application/ld+json')) {
        JSON.parse(scriptContent);
      } else {
        // Basic syntax check by compiling the JS content
        // Note: We replace template variables like {{COUPONS_JSON}} with mock values to avoid syntax errors in templates
        let testContent = scriptContent
          .replace(/\{\{[A-Z0-9_]+\}\}/g, 'null')
          .replace(/\{\{COUPONS_JSON\}\}/g, '[]')
          .replace(/\{\{PRODUCT_IMAGES_LIST_JSON\}\}/g, '[]')
          .replace(/\{\{PRODUCT_REVIEWS_JSON\}\}/g, '[]');

        new Function(testContent);
      }
      // console.log(`[OK] Script #${scriptIndex} in ${relPath} passed syntax check.`);
    } catch (err) {
      console.error(`\x1b[31m[ERROR]\x1b[0m Syntax error in script #${scriptIndex} of ${relPath}: ${err.message}`);
      // Show snippet of the problematic code
      const lines = scriptContent.split('\n');
      console.error('Code snippet:');
      console.error(lines.slice(0, 10).join('\n'));
      if (lines.length > 10) console.error('...');
      errors++;
    }
    scriptIndex++;
  }
});

console.log(`\nScript check finished. Total errors: ${errors}`);
if (errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
