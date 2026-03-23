// scripts/add-stable-ids-to-posts.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const POSTS_DIR = path.join(process.cwd(), 'source', '_posts');

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

function generateStableId() {
  const time = Date.now().toString(36);
  const random = crypto.randomBytes(10).toString('hex');
  return `${time}${random}`.slice(0, 28);
}

function hasFrontMatter(content) {
  return content.startsWith('---\n') || content.startsWith('---\r\n');
}

function splitFrontMatter(content) {
  const normalized = content.replace(/\r\n/g, '\n');

  if (!normalized.startsWith('---\n')) {
    return null;
  }

  const endIndex = normalized.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return null;
  }

  const start = '---\n'.length;
  const frontMatter = normalized.slice(start, endIndex);
  const body = normalized.slice(endIndex + '\n---\n'.length);

  return { frontMatter, body };
}

function frontMatterHasId(frontMatter) {
  return /^id:\s*.+$/mi.test(frontMatter);
}

function insertIdIntoFrontMatter(frontMatter, id) {
  const lines = frontMatter.split('\n');

  const titleIndex = lines.findIndex((line) => /^title:\s*/i.test(line));
  if (titleIndex !== -1) {
    lines.splice(titleIndex + 1, 0, `id: ${id}`);
    return lines.join('\n');
  }

  lines.unshift(`id: ${id}`);
  return lines.join('\n');
}

function createFrontMatterWithId(content, id) {
  const normalized = content.replace(/\r\n/g, '\n');
  return `---\nid: ${id}\n---\n${normalized}`;
}

const files = walk(POSTS_DIR);
const report = [];

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');

  if (!hasFrontMatter(original)) {
    const id = generateStableId();
    const updated = createFrontMatterWithId(original, id);
    fs.writeFileSync(file, updated, 'utf8');

    report.push({
      file: path.relative(process.cwd(), file),
      status: 'created_front_matter_and_id',
      id,
    });
    continue;
  }

  const parsed = splitFrontMatter(original);
  if (!parsed) {
    report.push({
      file: path.relative(process.cwd(), file),
      status: 'skipped_invalid_front_matter',
    });
    continue;
  }

  if (frontMatterHasId(parsed.frontMatter)) {
    report.push({
      file: path.relative(process.cwd(), file),
      status: 'already_has_id',
    });
    continue;
  }

  const id = generateStableId();
  const newFrontMatter = insertIdIntoFrontMatter(parsed.frontMatter, id);
  const updated = `---\n${newFrontMatter}\n---\n${parsed.body}`;

  fs.writeFileSync(file, updated, 'utf8');

  report.push({
    file: path.relative(process.cwd(), file),
    status: 'id_added',
    id,
  });
}

fs.writeFileSync(
  path.join(process.cwd(), 'posts-id-report.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log('Concluído.');
console.log('Relatório: posts-id-report.json');