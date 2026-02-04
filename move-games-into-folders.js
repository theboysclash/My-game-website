const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'games');

const files = fs.readdirSync(gamesDir)
  .filter(f => f.endsWith('.html'));

let moved = 0;
for (const file of files) {
  const base = path.basename(file, '.html');
  const folder = path.join(gamesDir, base);
  const destFile = path.join(folder, file);

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  const src = path.join(gamesDir, file);
  if (fs.existsSync(src)) {
    fs.renameSync(src, destFile);
    console.log('Moved:', file, '->', base + '/' + file);
    moved++;
  }
}
console.log('Done. Moved', moved, 'games into their own folders.');
