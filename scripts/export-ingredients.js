const fs = require('fs');
const path = require('path');

function normalizeIngredients(ing) {
  if (! ing) return [];
  if (Array.isArray(ing)) return ing;
  if (typeof ing === 'object' && Array.isArray(ing.list)) return ing.list;
  return [];
}

function main() {
  // fonte: JSON gerado pelo Hexo (public) OU por fallback (scripts/out)
  const sourcePublic = path.join(__dirname, '..', 'public', 'api', 'receitas.json');
  const sourceOut = path.join(__dirname, 'out', 'receitas.json');

  // saída preferencial (fora do public para não quebrar no clean)
  const outDir = path.join(__dirname, 'out');
  const target = path.join(outDir, 'ingredients.json');
  const targetCsv = path.join(outDir, 'ingredients.csv');

  // garante pasta scripts/out
  fs.mkdirSync(outDir, { recursive: true });

  // escolhe a fonte que existir
  const source = fs.existsSync(sourcePublic) ? sourcePublic : sourceOut;

  if (!fs.existsSync(source)) {
    console.error(`Fonte não encontrada: ${sourcePublic}`);
    console.error(`(Dica) Rode primeiro: npx hexo generate`);
    process.exit(1);
  }

  const raw = fs.readFileSync(source, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler JSON fonte:', e.message);
    process.exit(1);
  }

  const receitas = Array.isArray(data.receitas) ? data.receitas : [];
  const output = {
    count: receitas.length,
    generatedAt: new Date().toISOString(),
    ingredientsByRecipe: receitas.map(r => ({
      slug: r.slug || null,
      title: r.title || null,
      ingredients: normalizeIngredients(r.ingredients)
    }))
  };

  fs.writeFileSync(target, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Gerado: ${target} (recipes: ${output.count})`);

  // Exporta CSV (slug,title,ingredient)
  const escapeCsv = (val) => {
    const s = (val === undefined || val === null) ? '' : String(val);
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const header = ['slug', 'title', 'ingredient'].join(',');
  const rows = [header];
  for (const r of receitas) {
    const ings = normalizeIngredients(r.ingredients);
    for (const ing of ings) {
      rows.push([escapeCsv(r.slug || ''), escapeCsv(r.title || ''), escapeCsv(ing || '')].join(','));
    }
  }
  fs.writeFileSync(targetCsv, rows.join('\n'), 'utf8');
  console.log(`Gerado: ${targetCsv} (rows: ${rows.length - 1})`);
}

if (require.main === module) {
  main();
}
