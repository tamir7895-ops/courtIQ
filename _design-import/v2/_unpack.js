// Parse the bundled archive from Claude Design and split into html/css/components
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, '_archive.txt');

// Normalize CRLF/CR to LF since PowerShell may have written CRLFs
const archive = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const FILE_DELIM = '\n===CIQDS_FILE_DELIM_v1===\n';
const END_FILE = '\n===CIQDS_END_FILE_v1===';

// Split into entries by END_FILE marker (between entries)
const entries = archive.split(END_FILE);

let written = 0;
const skipped = [];

for (const entry of entries) {
  // Each entry: <name>\n---<FILE_DELIM><content>
  const idx = entry.indexOf(FILE_DELIM);
  if (idx < 0) {
    skipped.push('Missing delim in entry of length ' + entry.length);
    continue;
  }
  // header is everything before FILE_DELIM; content is after
  const header = entry.substring(0, idx);
  const content = entry.substring(idx + FILE_DELIM.length);
  // header looks like "<name>\n---" - take first line
  const name = header.split('\n')[0].trim();
  if (!name) {
    skipped.push('Empty name');
    continue;
  }

  // Decide subfolder by extension
  let subdir;
  if (name.endsWith('.html')) subdir = 'html';
  else if (name.endsWith('.css')) subdir = 'css';
  else if (name.endsWith('.jsx') || name.endsWith('.js')) subdir = 'components';
  else subdir = 'misc';

  const outPath = path.join(ROOT, subdir, name);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  written++;
}

console.log('Written:', written);
console.log('Skipped:', skipped.length);
if (skipped.length) console.log(skipped.join('\n'));
