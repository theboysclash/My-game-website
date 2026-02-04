const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'games');
const imagesDir = path.join(__dirname, 'images');

// Get all game subfolders; each contains one .html (the game)
const subdirs = fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.'))
  .map(d => d.name)
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const ICON_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico'];

function findIconInDir(dirPath, baseDir) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      const base = path.basename(e.name, ext).toLowerCase();
      if (base === 'icon' && ICON_EXTS.includes(ext)) {
        return path.relative(baseDir, path.join(dirPath, e.name)).replace(/\\/g, '/');
      }
    }
  }
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith('.')) {
      const found = findIconInDir(path.join(dirPath, e.name), baseDir);
      if (found) return found;
    }
  }
  return null;
}

const gameEntries = [];
for (const dir of subdirs) {
  const dirPath = path.join(gamesDir, dir);
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
  if (files.length === 0) continue;
  const htmlFile = files.find(f => f.toLowerCase() === 'index.html') || files[0];
  const iconPath = findIconInDir(dirPath, __dirname);
  gameEntries.push({ folder: dir, file: htmlFile, path: dir + '/' + htmlFile, icon: iconPath });
}

// Get all image files we can use for thumbnails
const imageFiles = new Set(
  fs.readdirSync(imagesDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) && !f.startsWith('.');
  })
);

// Convert filename to possible image names (without extension)
function baseName(file) {
  return path.basename(file, path.extname(file));
}
function slug(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}
function displayName(fileOrFolder) {
  const base = fileOrFolder.includes('/') ? path.basename(fileOrFolder, path.extname(fileOrFolder)) : fileOrFolder;
  return base
    .replace(/\./g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b(\d+)\b/g, ' $1 ')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ');
}

// Find best matching image for a game file
function findImage(gameFile) {
  const base = baseName(gameFile);
  const baseSlug = slug(base);
  const ext = path.extname(gameFile);

  const candidates = Array.from(imageFiles).map(img => ({
    file: img,
    name: path.basename(img, path.extname(img)),
    slug: slug(path.basename(img, path.extname(img))),
  }));

  // Exact match on filename (without extension)
  let match = candidates.find(c => c.slug === baseSlug || c.name.toLowerCase() === base.toLowerCase());
  if (match) return match.file;

  // Base contains image name or vice versa
  match = candidates.find(c => baseSlug.includes(c.slug) || c.slug.includes(baseSlug));
  if (match) return match.file;

  // FNAF special cases
  if (base.toLowerCase().includes('fnaf')) {
    if (base.toLowerCase().includes('sl') || base.toLowerCase().includes('sister')) return 'fnafsl.jpeg';
    if (base.includes('4')) return 'fnaf4.jpeg';
    if (base.includes('3')) return 'fnaf3.jpeg';
    if (base.includes('2')) return 'fnaf2.jpeg';
    return 'fnaf1.jpeg';
  }

  return null;
}

const games = gameEntries.map(({ folder, path: filePath, icon: folderIcon }) => {
  const htmlFile = path.basename(filePath);
  const nameSource = htmlFile.toLowerCase() === 'index.html' ? folder : filePath;
  const name = displayName(nameSource);
  const globalImage = findImage(htmlFile.toLowerCase() === 'index.html' ? folder : htmlFile);
  // Prefer icon from game folder (path relative to project); else global images/ filename
  const image = folderIcon ? 'games/' + folderIcon : (globalImage ? 'images/' + globalImage : null);
  return { file: filePath, name, image: image || null };
});

const gamesJs = games
  .map(g => `      { file: '${String(g.file).replace(/'/g, "\\'")}', name: '${String(g.name).replace(/'/g, "\\'")}', image: ${g.image ? `'${String(g.image).replace(/'/g, "\\'")}'` : 'null'} }`)
  .join(',\n');

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const startMarker = '    const GAMES = [';
const endMarker = '    ];';
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker);
if (start === -1 || end === -1) throw new Error('Could not find GAMES array in index.html');
const newBlock = startMarker + '\n' + gamesJs + '\n' + endMarker;
html = html.slice(0, start) + newBlock + html.slice(end + endMarker.length);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Updated index.html with', games.length, 'games from games/');
console.log('Games with images:', games.filter(g => g.image).length);
console.log('Games without images:', games.filter(g => !g.image).length);
