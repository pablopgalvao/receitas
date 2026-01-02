// padronizar_posts.js
// Padroniza posts em source/_posts/receitas seguindo o template:
// - Front-matter com ingredients.list (somente ingredientes canônicos/limpos)
// - Corpo com: imagens, Informações, Ingredientes (display), Modo de Preparo
//
// Regras chave:
// - ingredients.list NÃO pode ter quantidade, "cru", "com casca", "em cubos", etc.
// - Se houver alternativas tipo "azeite (ou óleo)" -> vira ["azeite","óleo"]
// - Valida contra scripts/ingredients-base.json e, na dúvida, pergunta no terminal.
//
// Base (crie/edite):
// scripts/ingredients-base.json
// {
//   "canonical": ["arroz", "azeite", "óleo", ...],
//   "synonyms": { "oleo": "óleo", "azeite de oliva": "azeite", ... }
// }

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const readline = require("readline");

const postsDir = "./source/_posts/receitas";

/* =========================
   Base canônica + sinônimos
   ========================= */

function loadIngredientOverrides() {
  const p = path.join(__dirname, 'data', 'ingredients-overrides.json');
  if (!fs.existsSync(p)) return new Map();

  try {
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    const overrides = json.overrides && typeof json.overrides === 'object'
      ? json.overrides
      : {};

    return new Map(
      Object.entries(overrides).map(([k, v]) => [
        String(k).toLowerCase(),
        String(v).toLowerCase()
      ])
    );
  } catch {
    return new Map();
  }
}

const OVERRIDE_MAP = loadIngredientOverrides();

const OVERRIDES_PATH = path.join(__dirname, 'data', 'ingredients-overrides.json');

function ensureOverridesFile() {
  const dir = path.dirname(OVERRIDES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(OVERRIDES_PATH)) {
    const initial = {
      _meta: {
        description: 'Overrides manuais para normalização de ingredientes',
        priority: 'overrides > synonyms > canonical > prompt',
        lastUpdated: new Date().toISOString().slice(0, 10)
      },
      overrides: {}
    };
    fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readOverridesJson() {
  ensureOverridesFile();
  try {
    const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (!json.overrides || typeof json.overrides !== 'object') json.overrides = {};
    if (!json._meta || typeof json._meta !== 'object') json._meta = {};
    return json;
  } catch {
    return { _meta: {}, overrides: {} };
  }
}

function saveOverride(normalized, canonical) {
  // normalized e canonical DEVEM estar em lower-case
  ensureOverridesFile();

  const json = readOverridesJson();
  const key = String(normalized).toLowerCase().trim();
  const val = String(canonical).toLowerCase().trim();

  if (!key || !val) return;

  // evita escrever se não mudou
  if (json.overrides[key] === val) return;

  json.overrides[key] = val;
  json._meta.lastUpdated = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(json, null, 2), 'utf8');

  // mantém em memória também
  OVERRIDE_MAP.set(key, val);

  console.log(`✅ Salvo override: "${key}" → "${val}"`);
}


function loadIngredientBase() {
  const basePath = path.join(__dirname, 'data', 'ingredients-base.json');
  if (!fs.existsSync(basePath)) return { canonical: [], synonyms: {} };

  try {
    const raw = fs.readFileSync(basePath, "utf8");
    const data = JSON.parse(raw);
    return {
      canonical: Array.isArray(data.canonical) ? data.canonical : [],
      synonyms: data.synonyms && typeof data.synonyms === "object" ? data.synonyms : {},
    };
  } catch {
    return { canonical: [], synonyms: {} };
  }
}

const ING_BASE = loadIngredientBase();
const CANON_SET = new Set((ING_BASE.canonical || []).map((s) => String(s).toLowerCase()));
const SYN_MAP = new Map(
  Object.entries(ING_BASE.synonyms || {}).map(([k, v]) => [String(k).toLowerCase(), String(v)])
);

/* =========================
   CSV ingredients (opcional)
   ========================= */

function findIngredientsCsv() {
  const candidates = [
    path.join(__dirname, "scripts", "out", "ingredients.csv"),
    path.join(__dirname, "public", "api", "ingredients.csv"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseIngredientsCsv(csvPath) {
  if (!csvPath) return new Map();
  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  // slug,title,ingredient
  lines.shift();

  const map = new Map(); // slugBase -> [ingredients display]
  for (const line of lines) {
    // CSV simples com aspas: captura campos entre aspas ou sem aspas
    const fields = [];
    const re = /"([^"]*)"|([^,]+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const v = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : "";
      fields.push(v);
    }
    if (fields.length < 3) continue;

    const slug = String(fields[0] || "").trim();
    const ingredient = String(fields[2] || "").trim();
    if (!slug || !ingredient) continue;

    const slugBase = slug.replace(/^.*\//, "").toLowerCase();
    if (!map.has(slugBase)) map.set(slugBase, []);
    map.get(slugBase).push(ingredient);
  }

  // dedup mantendo ordem
  for (const [k, arr] of map.entries()) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const key = String(x).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(x);
    }
    map.set(k, out);
  }

  return map;
}

/* =========================
   Parser de front-matter
   ========================= */

function parseWithMissingStartFM(content) {
  if (!content.startsWith("---")) {
    const hasEndMarker = /(^|\r?\n)---(\r?\n)/.test(content);
    if (hasEndMarker) {
      const fixed = `---\n${content}`;
      try {
        return matter(fixed);
      } catch (_) {}
    }
  }
  return matter(content);
}

/* =========================
   Extratores
   ========================= */

function extractSection(body, titleRegex) {
  const match = body.match(titleRegex);
  if (!match) return null;

  const start = match.index + match[0].length;
  const rest = body.slice(start);

  // qualquer novo cabeçalho ## ou ### delimita
  const nextHeader = rest.search(/^##\s|^###\s/m);
  const end = nextHeader !== -1 ? start + nextHeader : body.length;

  return body.slice(start, end).trim();
}

function extractImages(body) {
  const imageRegex = /!\[[^\]]*\]\([^\)]+\)/g;
  const images = body.match(imageRegex) || [];
  return images.join("\n");
}

function normalizeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    return val
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/* =========================
   Split alternativas (ou /)
   ========================= */

function splitAlternatives(text) {
  if (!text) return [];
  let s = String(text);

  // traz conteúdo de parênteses pra fora: "(ou óleo)" -> " ou óleo "
  s = s.replace(/\(([^)]*)\)/g, " $1 ");

  // separa por " ou " e por "/"
  const parts = s
    .split(/\s+\bou\b\s+|\s*\/\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);

  return parts.length ? parts : [String(text).trim()];
}

/* =========================
   Normalização forte (list)
   ========================= */

function normalizeIngredientForList(text) {
  if (!text) return "";
  let s = String(text).trim();

  // remove bullet
  s = s.replace(/^[-•]\s*/, "").trim();

  // remove "a gosto"
  s = s.replace(/\ba\s+gosto\b/gi, " ").trim();

  // remove descritores comuns
  s = s.replace(/\b(cru[as]?|cozid[ao]s?|assad[ao]s?|frit[ao]s?)\b/gi, " ");
  s = s.replace(/\b(com\s+casca|sem\s+casca|sem\s+pele|com\s+pele)\b/gi, " ");

  // remove preparos / cortes / formas
  s = s.replace(
    /\b(picad[ao]s?|fatiad[ao]s?|ralad[ao]s?|amassad[ao]s?|moíd[ao]s?|espremid[ao]s?|triturad[ao]s?)\b/gi,
    " "
  );
  s = s.replace(/\b(em\s+cubos?|em\s+pedaços?|em\s+tiras?|em\s+rodelas?|em\s+fatias?)\b/gi, " ");

  // remove adjetivos comuns (exibição)
  s = s.replace(/\b(grandes?|pequenos?|médios?|fina|finas|grosso|grossa)\b/gi, " ");

  // remove pontuação
  s = s.replace(/[,:;.!?]+/g, " ");

  // remove quantidade no INÍCIO: "2 a 3", "1/2", "200", etc.
  s = s.replace(/^\s*(\d+\s*a\s*\d+|\d+([.,]\d+)?|\d+\/\d+)\s*/i, "");

  // remove unidades no início: "xícara de chá de", "colher de sopa de", etc.
  s = s
    .replace(/^(?:cerca de\s*|aprox\.?\s*|aproximadamente\s*)?/i, "")
    .replace(
      /^(?:g|gr|gramas?|kg|ml|l|litros?|xícaras?(?:\s+de\s+(?:chá|sopa|café))?|colheres?(?:\s+de\s+(?:sopa|chá|café))?|copos?|tabletes?|dentes?|unidades?|folhas?|peças?)\b\s*(?:de\s+)?/i,
      ""
    )
    .trim();

  // remove quantidades no FIM: "arroz 200 gramas", "cebola 90 g", "talos 30 gr"
  s = s.replace(/\s+\d+([.,]\d+)?\s*(g|gr|gramas?|kg|ml|l|litros?)\b/gi, " ");
  s = s.replace(/\s+\d+\s*(unidades?|dentes?|colheres?|xícaras?|copos?)\b/gi, " ");

  // remove "de" isolado no começo/fim
  s = s.replace(/^\s*de\s+/i, "").replace(/\s+de\s*$/i, "").trim();

  // normaliza espaços
  s = s.replace(/\s{2,}/g, " ").trim();

  // final em lower para comparação
  return s.toLowerCase();
}

/* =========================
   Display cleanup (corpo)
   ========================= */

function cleanupDisplayIngredientLine(line) {
  if (!line) return "";
  let s = String(line).trim();

  // remove bullet
  s = s.replace(/^[-•]\s*/, "").trim();

  // remove vírgulas/pontos no final (ex: "pimenta-do-reino,")
  s = s.replace(/[\s,;:.!?]+$/g, "").trim();

  if (!s || s === "---" || /^-+$/.test(s)) return "";
  return s;
}

/* =========================
   Seções do template
   ========================= */

function buildInfoSection(data) {
  const categorias = Array.isArray(data.categories) ? data.categories.join(", ") : data.categories || "";
  return [
    "## 📝 Informações da Receita",
    "",
    `- **Categoria:** ${categorias}`,
    `- **Dificuldade:** ${data.difficulty || ""}`,
    `- **Rendimento:** ${data.servings || ""}`,
    `- **Tempo de preparo:** ${data.time || ""}`,
    `- **Calorias:** ${data.calories || ""}`,
    "",
    "---",
    "",
  ].join("\n");
}

function buildIngredientsSection(items) {
  const lines = items.length ? items.map((i) => `- ${i}`) : ["- Ingrediente 1"];
  return ["## 🧄 Ingredientes", "", ...lines, "", "---", ""].join("\n");
}

function buildStepsSection(steps) {
  const lines = steps.length ? steps.map((s, i) => `${i + 1}. ${s}`) : ["1. Passo 1", "2. Passo 2"];
  return ["## 👨‍🍳 Modo de Preparo", "", ...lines, ""].join("\n");
}

/* =========================
   Terminal: pergunta na dúvida
   ========================= */

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function topSuggestions(term, max = 6) {
  const all = (ING_BASE.canonical || []).map((x) => String(x).toLowerCase());
  const ranked = all
    .map((x) => ({ x, d: levenshtein(term, x) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((o) => o.x);
  return ranked;
}

async function resolveCanonicalInteractive(originalLine, normalized) {
  // 0) override manual (prioridade máxima)
  if (OVERRIDE_MAP.has(normalized)) {
    return OVERRIDE_MAP.get(normalized);
  }

  // 1) sinônimo direto
  if (SYN_MAP.has(normalized)) {
    const v = String(SYN_MAP.get(normalized)).toLowerCase();
    // opcional: persistir sinônimo como override (pra acelerar)
    saveOverride(normalized, v);
    return v;
  }

  // 2) já é canônico
  if (CANON_SET.has(normalized)) {
    // opcional: persistir como override (pra acelerar)
    saveOverride(normalized, normalized);
    return normalized;
  }

  // 3) se não tem base, mantém e salva (pra não perguntar de novo)
  if (!CANON_SET.size) {
    saveOverride(normalized, normalized);
    return normalized;
  }

  // 4) pergunta no terminal
  const suggestions = topSuggestions(normalized, 6);

  console.log('\nIngrediente não encontrado na base:');
  console.log('  Original    :', originalLine);
  console.log('  Normalizado :', normalized);
  console.log('Sugestões:');
  suggestions.forEach((s, i) => console.log(`  [${i + 1}] ${s}`));
  console.log('  [0] manter como está (normalizado)');
  console.log('  [n] digitar manualmente');

  const ans = String(await ask('Escolha uma opção: ')).trim().toLowerCase();

  let chosen = normalized;

  if (ans === 'n') {
    const manual = String(await ask('Digite o ingrediente canônico: ')).trim().toLowerCase();
    chosen = manual || normalized;
    saveOverride(normalized, chosen);
    return chosen;
  }

  const num = parseInt(ans, 10);
  if (!Number.isNaN(num)) {
    if (num === 0) {
      chosen = normalized;
      saveOverride(normalized, chosen);
      return chosen;
    }
    if (num >= 1 && num <= suggestions.length) {
      chosen = suggestions[num - 1];
      saveOverride(normalized, chosen);
      return chosen;
    }
  }

  // fallback (salva mesmo assim pra não perguntar de novo)
  saveOverride(normalized, chosen);
  return chosen;
}

/* =========================
   MAIN
   ========================= */

(async function run() {
  if (!fs.existsSync(postsDir)) {
    console.error(`Diretório não encontrado: ${postsDir}`);
    process.exit(1);
  }

  const csvPath = findIngredientsCsv();
  const csvIngredientsBySlug = parseIngredientsCsv(csvPath);

  if (!csvPath) console.warn("Aviso: ingredients.csv não encontrado. Mantendo ingredientes do post.");
  else console.log(`Usando ingredientes do CSV: ${csvPath}`);

  const files = fs.readdirSync(postsDir);

  for (const file of files) {
    if (path.extname(file) !== ".md") continue;

    const filePath = path.join(postsDir, file);
    const raw = fs.readFileSync(filePath, "utf8");

    let parsed;
    try {
      parsed = parseWithMissingStartFM(raw);
    } catch {
      parsed = { data: {}, content: raw };
    }

    const data = parsed.data || {};
    const body = String(parsed.content || "").trim();

    // imagens topo
    const images = extractImages(body);

    // seções existentes (caso já existam)
    const ingSection = extractSection(body, /^##.*Ingredientes[^\n]*\n/mi);
    const prepSection = extractSection(body, /^##.*Modo\s+de\s+Preparo[^\n]*\n/mi);

    // DISPLAY ingredients (corpo): mantém quantidade/descrição
    let displayIngredients = [];
    const fileBase = file.replace(/\.md$/i, "").toLowerCase();

    if (csvIngredientsBySlug.has(fileBase)) {
      displayIngredients = csvIngredientsBySlug.get(fileBase);
    } else if (ingSection) {
      displayIngredients = ingSection
        .split("\n")
        .map(cleanupDisplayIngredientLine)
        .filter(Boolean);
    } else if (data.ingredients && Array.isArray(data.ingredients.list)) {
      displayIngredients = normalizeArray(data.ingredients.list).map((x) => String(x));
    } else if (Array.isArray(data.ingredients)) {
      displayIngredients = normalizeArray(data.ingredients).map((x) => String(x));
    }

    displayIngredients = displayIngredients.map(cleanupDisplayIngredientLine).filter(Boolean);

    // dedup display mantendo ordem
    const uniqDisplay = [];
    {
      const seen = new Set();
      for (const it of displayIngredients) {
        const key = it.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniqDisplay.push(it);
      }
    }

    // INDEX ingredients (front-matter): canônico/limpo + split "ou" + valida e pergunta
    const indexResolved = [];
    {
      const seen = new Set();
      for (const original of uniqDisplay) {
        const parts = splitAlternatives(original);
        for (const p of parts) {
          const normalized = normalizeIngredientForList(p);
          if (!normalized) continue;

          const canonical = await resolveCanonicalInteractive(original, normalized);
          const key = canonical.toLowerCase();
          if (seen.has(key)) continue;

          seen.add(key);
          indexResolved.push(canonical);
        }
      }
    }

    // passos
    let steps = [];
    if (prepSection) {
      steps = prepSection
        .split("\n")
        .filter((l) => /^\d+\.\s*/.test(l))
        .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        .filter((l) => l && !l.startsWith("##") && l !== "---");
    } else {
      // fallback: quebra por blocos
      const bodyWithoutImages = body.replace(/!\[[^\]]*\]\([^\)]+\)/g, "").trim();
      steps = bodyWithoutImages
        .split(/\n\n+/)
        .map((s) => s.replace(/\n/g, " ").trim())
        .filter(Boolean);
    }

    // Front-matter padrão (igual seu exemplo)
    const newData = {
      title: data.title || file.replace(/_/g, " ").replace(/\.md$/i, "").trim(),
      date: data.date || new Date().toISOString(),
      categories: normalizeArray(data.categories).length ? normalizeArray(data.categories) : ["Novas receitas"],
      tags: normalizeArray(data.tags),
      ingredients: { list: indexResolved },
      difficulty: data.difficulty || "",
      servings: data.servings || "",
      time: data.time || "",
      calories: data.calories !== undefined && data.calories !== null ? data.calories : "",
      author: data.author || "Boil",
    };

    // Corpo padrão (igual seu exemplo)
    const parts = [];
    if (images) parts.push(images, "");
    parts.push(buildInfoSection(newData), buildIngredientsSection(uniqDisplay.length ? uniqDisplay : indexResolved), buildStepsSection(steps));

    const finalBody = parts.join("\n");
    const finalContent = matter.stringify(finalBody, newData);

    fs.writeFileSync(filePath, finalContent, "utf8");
    console.log(`Post padronizado: ${file}`);
  }
})();
