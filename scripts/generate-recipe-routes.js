// scripts/generate-recipe-routes.js
// Este script percorre os arquivos de receita, extrai o slug e o ID de cada um, e gera um arquivo JSON mapeando cada slug para a URL da receita correspondente. Ele também identifica slugs duplicados e os registra em um arquivo separado para revisão.
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(process.cwd(), 'source', '_posts');
const OUTPUT_FILE = path.join(process.cwd(), 'source', 'recipe-routes.json');
const DUP_FILE = path.join(process.cwd(), 'recipe-routes-duplicates.json');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function getFrontMatterBlock(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return '';
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return '';
  return normalized.slice(4, end);
}

function extractField(block, fieldName) {
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'mi');
  const match = block.match(regex);
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
}

function getEffectiveSlug(filePath, block) {
  return extractField(block, 'slug') || path.basename(filePath, '.md');
}

const files = walk(POSTS_DIR);
const grouped = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const block = getFrontMatterBlock(content);

  const slug = getEffectiveSlug(file, block);
  const id = extractField(block, 'id');
  const title = extractField(block, 'title') || path.basename(file, '.md');

  if (!id) continue;

  if (!grouped.has(slug)) grouped.set(slug, []);
  grouped.get(slug).push({
    slug,
    id,
    title,
    url: `/${slug}/${id}/`,
    file: path.relative(process.cwd(), file),
  });
}

const routes = {};
const duplicates = [];

for (const [slug, items] of grouped.entries()) {
  if (items.length === 1) {
    routes[slug] = items[0].url;
  } else {
    duplicates.push({ slug, items });
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(routes, null, 2), 'utf8');
fs.writeFileSync(DUP_FILE, JSON.stringify(duplicates, null, 2), 'utf8');

console.log(`Arquivo gerado: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
console.log(`Duplicados: ${path.relative(process.cwd(), DUP_FILE)}`);