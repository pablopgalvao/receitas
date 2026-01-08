/**
 * receitas-cli.js
 * Organiza receitas em source/_drafts/receitas e/ou source/_posts/receitas
 *
 * Modos:
 *  --audit    => só analisa, não altera
 *  --autofix  => padroniza esqueleto SEM perder informação
 *  --review   => revisão interativa para ingredients.list (canônicos)
 *
 * Alvo:
 *  --drafts | --posts | --all
 *
 * Extras:
 *  --defer        => se precisar decisão, pula e marca flag "needs_review"
 *  --limit N      => processa no máximo N arquivos
 *  --dry-run      => não grava arquivos
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const matter = require("gray-matter");

const POSTS_DIR = path.join("source", "_posts", "receitas");
const DRAFTS_DIR = path.join("source", "_drafts", "receitas");

const MODE_AUDIT = process.argv.includes("--audit");
const MODE_AUTOFIX = process.argv.includes("--autofix");
const MODE_REVIEW = process.argv.includes("--review");

const TARGET_DRAFTS = process.argv.includes("--drafts");
const TARGET_POSTS = process.argv.includes("--posts");
const TARGET_ALL = process.argv.includes("--all") || (!TARGET_DRAFTS && !TARGET_POSTS);

const DEFER = process.argv.includes("--defer");
const DRY_RUN = process.argv.includes("--dry-run");

const LIMIT_IDX = process.argv.findIndex((a) => a === "--limit");
const LIMIT = LIMIT_IDX !== -1 ? parseInt(process.argv[LIMIT_IDX + 1], 10) : Infinity;

if (!MODE_AUDIT && !MODE_AUTOFIX && !MODE_REVIEW) {
  console.log("Use um modo: --audit ou --autofix ou --review");
  process.exit(1);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

/* =========================
   Parse robusto (front-matter)
   ========================= */
function parseWithMissingStartFM(raw) {
  if (raw.startsWith("---")) return matter(raw);

  // caso legado: começa com "title:" e tem uma linha "---" como fim do YAML
  const m = raw.match(/^\s*---\s*$/m);
  if (m && typeof m.index === "number") {
    const idx = m.index;
    const yamlPart = raw.slice(0, idx).trim();
    const rest = raw.slice(idx + m[0].length).replace(/^\r?\n/, "");
    const fixed = `---\n${yamlPart}\n---\n${rest}`;
    return matter(fixed);
  }
  return matter(raw);
}

function normalizeArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
  return [];
}

/* =========================
   Seções do corpo
   ========================= */
function extractImages(body) {
  const imageRegex = /!\[[^\]]*\]\([^\)]+\)/g;
  const images = body.match(imageRegex) || [];
  return images.join("\n");
}

function extractSection(body, headerRegex) {
  const m = body.match(headerRegex);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const next = rest.search(/^##\s/m);
  const end = next !== -1 ? start + next : body.length;
  return body.slice(start, end).trim();
}

function linesFromBullets(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function linesFromNumbered(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, "").trim())
    .filter(Boolean);
}

/* =========================
   Normalização de tempo
   ========================= */
function normalizeTime(raw) {
  if (!raw) return "";

  let t = String(raw).toLowerCase().trim();

  // normaliza separadores
  t = t.replace(/,/g, ".").replace(/\s+/g, " ");

  // minutos
  t = t.replace(/\bminutos?\b|\bmins?\b|\bmin\b/g, "min");

  // horas
  t = t.replace(/\bhoras?\b|\bh\b/g, "hora");

  // "1 minuto(s)" -> "1 min"
  t = t.replace(/(\d+)\s*(minuto\(s\)|minutos?)/g, "$1 min");

  // "2 hora" -> "2 horas"
  t = t.replace(/(\d+)\s*hora\b/g, "$1 hora");
  t = t.replace(/(\d+)\s*horas\b/g, "$1 horas");

  // espaço obrigatório: "18min" -> "18 min"
  t = t.replace(/(\d)(min|hora|horas)/g, "$1 $2");

  // remove duplicações
  t = t.replace(/\s{2,}/g, " ").trim();

  return t;
}

/* =========================
   Heurística leve (NÃO agressiva) para identificar “lixo”
   - Serve para sugerir, não para apagar automaticamente no autofix.
   ========================= */
function looksLikeNavOrRelated(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return true;

  // menus / categorias comuns
  if (
    /(receitas|blogs|curso|loja|vídeo|favoritas|explore|entradas|sobremesas|saladas|carnes|aperitivos|molhos|patês|sopas|bebidas)/.test(
      t
    )
  )
    return true;

  // títulos relacionados (sem unidades/quantidade)
  const hasQty = /^\s*(\d+([.,]\d+)?|\d+\/\d+)\b/.test(t) || /\b(xícara|colher|grama|kg|ml|litro|a gosto)\b/.test(t);
  if (!hasQty && /(salada de|risoto de|bolo de|torta de|sopa de|rocambole|quiche|kibe)/.test(t)) return true;

  return false;
}

function looksLikeStep(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return true;
  if (t.length > 180) return true;
  if (/^(corte|pique|misture|bata|leve|coloque|adicione|junte|refogue|frite|cozinhe|asse|sirva|transfira|tempere)\b/.test(t))
    return true;
  return false;
}

/* =========================
   Ingredients base + overrides (para review)
   ========================= */
const ING_BASE_PATH = path.join("scripts", "ingredients-base.json");
const OVERRIDES_PATH = path.join("data", "ingredients-overrides.json");

function loadJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

const ING_BASE = loadJsonSafe(ING_BASE_PATH, { canonical: [], synonyms: {} });
const CANON_SET = new Set((ING_BASE.canonical || []).map((x) => String(x).toLowerCase()));
const SYN_MAP = new Map(Object.entries(ING_BASE.synonyms || {}).map(([k, v]) => [String(k).toLowerCase(), String(v).toLowerCase()]));

function ensureOverridesFile() {
  const dir = path.dirname(OVERRIDES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(OVERRIDES_PATH)) {
    fs.writeFileSync(
      OVERRIDES_PATH,
      JSON.stringify(
        {
          _meta: { lastUpdated: new Date().toISOString().slice(0, 10) },
          overrides: {},
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readOverrides() {
  ensureOverridesFile();
  const json = loadJsonSafe(OVERRIDES_PATH, { _meta: {}, overrides: {} });
  if (!json.overrides || typeof json.overrides !== "object") json.overrides = {};
  return json;
}

function saveOverride(from, to) {
  ensureOverridesFile();
  const json = readOverrides();
  json._meta.lastUpdated = new Date().toISOString().slice(0, 10);
  json.overrides[String(from).toLowerCase()] = String(to).toLowerCase();
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(json, null, 2), "utf8");
}

function normalizeForCanonical(s) {
  if (!s) return "";
  let t = String(s).toLowerCase().trim();
  t = t.replace(/^[-•]\s*/, "");
  t = t.replace(/\s{2,}/g, " ").trim();

  // remove quantidade/unidades (bem básico)
  t = t.replace(/^\s*(\d+\s*a\s*\d+|\d+([.,]\d+)?|\d+\/\d+)\s*/i, "");
  t = t.replace(
    /^(?:xícaras?(?:\s+de\s+(?:chá|sopa|café))?|colheres?(?:\s+de\s+(?:sopa|chá|café))?|g|gr|gramas?|kg|ml|l|litros?)\b\s*(?:de\s+)?/i,
    ""
  );
  t = t.replace(/\ba gosto\b/gi, "").trim();
  t = t.replace(/[,:;.!?]+/g, " ").replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^\s*de\s+/i, "").trim();

  return t;
}

/* =========================
   Template do modelo
   ========================= */
function buildInfoSection(data) {
  const cat = Array.isArray(data.categories) ? data.categories.join(", ") : (data.categories || "");
  return [
    "## 📝 Informações da Receita",
    "",
    `- **Categoria:** ${cat}`,
    `- **Dificuldade:** ${data.difficulty || ""}`,
    `- **Rendimento:** ${data.servings || ""}`,
    `- **Tempo de preparo:** ${data.time || ""}`,
    `- **Calorias:** ${data.calories || ""}`,
    "",
    "---",
    "",
  ].join("\n");
}

function buildIngredientsSection(listComplete) {
  const items = listComplete.length ? listComplete : ["[inserir se existir]"];
  return ["## 🧄 Ingredientes", "", ...items.map((x) => `- ${x}`), "", "---", ""].join("\n");
}

function buildStepsSection(steps) {
  const items = steps.length ? steps : ["[inserir se existir]"];
  return ["## 👨‍🍳 Modo de Preparo", "", ...items.map((s, i) => `${i + 1}. ${s}`), ""].join("\n");
}

/* =========================
   Detectar “receita inválida” (propaganda)
   ========================= */
function isLikelyInvalidRecipe(ingredientsComplete, steps) {
  const joined = (ingredientsComplete.join(" ") + " " + steps.join(" ")).toLowerCase();

  // caso parecido com o Maxixada: muitos nomes de marca/linhas e nada de preparo real
  const marketingSignals = /(seara|doriana|delícia|turma da mônica|certified humane|livres de conservantes)/.test(joined);
  const cookingSignals = /(corte|pique|misture|refogue|cozinhe|asse|forno|panela|fogo|tempere)/.test(joined);

  return marketingSignals && !cookingSignals;
}

/* =========================
   Carregar receitas (files)
   ========================= */
function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md")).map((f) => path.join(dir, f));
}

function pickTargets() {
  const targets = [];
  if (TARGET_ALL || TARGET_POSTS) targets.push(...listMdFiles(POSTS_DIR));
  if (TARGET_ALL || TARGET_DRAFTS) targets.push(...listMdFiles(DRAFTS_DIR));
  return targets;
}

/* =========================
   AUDIT
   ========================= */
function auditOne(filePath, raw, parsed) {
  const data = parsed.data || {};
  const body = String(parsed.content || "").trim();

  const title = (data.title || "").toString().trim();
  const time = (data.time || "").toString().trim();
  const difficulty = (data.difficulty || "").toString().trim();

  const ingBody = extractSection(body, /^##.*Ingredientes[^\n]*\n/mi);
  const prepBody = extractSection(body, /^##.*Modo\s+de\s+Preparo[^\n]*\n/mi);

  const ingFromYaml = Array.isArray(data.ingredients) ? data.ingredients : (data.ingredients && Array.isArray(data.ingredients.list) ? data.ingredients.list : []);
  const ingFromBody = linesFromBullets(ingBody);

  const stepsFromBody = linesFromNumbered(prepBody);

  const complete = ingFromBody.length ? ingFromBody : ingFromYaml;
  const steps = stepsFromBody;

  const suspiciousIngredients =
    complete.filter((x) => looksLikeNavOrRelated(x) || looksLikeStep(x)).length;

  const invalid = isLikelyInvalidRecipe(complete, steps);

  return {
    file: filePath,
    titleOk: !!title,
    hasTime: !!time,
    hasDifficulty: !!difficulty,
    hasIngredientsComplete: complete.length > 0,
    hasSteps: steps.length > 0,
    suspiciousIngredients,
    invalid,
    hasCanonicalList: !!(data.ingredients && Array.isArray(data.ingredients.list) && data.ingredients.list.length),
  };
}

/* =========================
   AUTOFIX (preserva tudo)
   - Nunca “limpa” removendo; no máximo marca flags e organiza layout.
   ========================= */
function buildAutofixContent(parsed, raw) {
  const data = parsed.data || {};
  const body = String(parsed.content || "").trim();

  const images = extractImages(body);

  const ingBody = extractSection(body, /^##.*Ingredientes[^\n]*\n/mi);
  const prepBody = extractSection(body, /^##.*Modo\s+de\s+Preparo[^\n]*\n/mi);

  // ingredientes completos: prioridade corpo, senão YAML array, senão YAML ingredients.list
  const ingYamlArray = Array.isArray(data.ingredients) ? data.ingredients : [];
  const ingYamlList = data.ingredients && Array.isArray(data.ingredients.list) ? data.ingredients.list : [];

  let complete = linesFromBullets(ingBody);
  if (!complete.length && ingYamlArray.length) complete = ingYamlArray.map(String);
  if (!complete.length && ingYamlList.length) complete = ingYamlList.map(String);

  // modo de preparo: prioridade seção numerada; se não tiver, tenta usar o corpo inteiro como “texto” (mas sem inventar)
  let steps = linesFromNumbered(prepBody);
  if (!steps.length) {
    // tenta recuperar qualquer lista numerada existente no body
    const numbered = body.match(/^\s*\d+\.\s+.+$/gm);
    steps = numbered ? numbered.map((l) => l.replace(/^\s*\d+\.\s+/, "").trim()).filter(Boolean) : [];
  }

  // flags
  const flags = new Set(normalizeArray(data.flags));
  const invalid = isLikelyInvalidRecipe(complete, steps);
  if (invalid) flags.add("invalid_source");
  if (!complete.length || !steps.length) flags.add("needs_review");

  // preservar canônicos existentes; se não existir, mantém vazio (para review)
  const canonicalList = (data.ingredients && Array.isArray(data.ingredients.list)) ? data.ingredients.list : [];

  const newData = {
    // preserva campos existentes, sem resetar
    title: (data.title || "").toString().trim() || "",
    date: data.date || new Date().toISOString(),
    categories: normalizeArray(data.categories).length ? normalizeArray(data.categories) : ["Novas Receitas"],
    tags: normalizeArray(data.tags),
    ingredients: { list: canonicalList.map((x) => String(x).toLowerCase()) },
    difficulty: (data.difficulty || "").toString(),
    servings: (data.servings || "").toString(),
    time: normalizeTime(data.time || ""),
    calories: (data.calories ?? "").toString(),
    author: (data.author || "Boil").toString(),
    flags: Array.from(flags),
  };

  // monta corpo no esqueleto do modelo
  const parts = [];
  if (images) parts.push(images, "");
  parts.push(buildInfoSection(newData), buildIngredientsSection(complete), buildStepsSection(steps));

  const finalBody = parts.join("\n");
  return matter.stringify(finalBody, newData);
}

/* =========================
   REVIEW (interativo)
   - Constrói/ajusta ingredients.list sem tocar na lista completa do corpo.
   ========================= */
async function reviewCanonicalForFile(parsed, raw) {
  const data = parsed.data || {};
  const body = String(parsed.content || "").trim();

  const ingBody = extractSection(body, /^##.*Ingredientes[^\n]*\n/mi);

  // completos (do corpo ou YAML)
  const ingYamlArray = Array.isArray(data.ingredients) ? data.ingredients : [];
  let complete = linesFromBullets(ingBody);
  if (!complete.length && ingYamlArray.length) complete = ingYamlArray.map(String);

  // se não tem completos, nada a revisar
  if (!complete.length) {
    return { changed: false, reason: "Sem ingredientes completos para revisar" };
  }

  const overrides = readOverrides().overrides || {};

  const currentCanon = (data.ingredients && Array.isArray(data.ingredients.list)) ? data.ingredients.list.map(String) : [];
  const canonSet = new Set(currentCanon.map((x) => x.toLowerCase()));

  console.log("\n==============================");
  console.log(`REVIEW: ${(data.title || "(sem título)")}`);
  console.log(`Ingredientes completos: ${complete.length}`);
  console.log(`Canônicos atuais: ${currentCanon.length}\n`);

  // Sugestão por linha completa -> 1 canônico por default (você pode mudar)
  for (const line of complete) {
    // pula lixo óbvio, mas deixa você decidir (não removemos nada do corpo)
    if (looksLikeNavOrRelated(line) || looksLikeStep(line)) {
      console.log(`\n(AVISO) Linha parece lixo/relacionado/preparo: "${line}"`);
      const ans = (await ask("Adicionar algo canônico mesmo assim? [s/N]: ")).trim().toLowerCase();
      if (!/^s/.test(ans)) continue;
    }

    const norm = normalizeForCanonical(line);
    if (!norm) continue;

    // aplica override/synônimo/canônico
    let suggestion =
      overrides[norm] ||
      SYN_MAP.get(norm) ||
      (CANON_SET.has(norm) ? norm : null);

    if (suggestion && canonSet.has(suggestion.toLowerCase())) continue;

    console.log(`\nOriginal: ${line}`);
    console.log(`Normal.: ${norm}`);
    console.log(`Sugest.: ${suggestion || "(nenhuma)"}`);
    console.log("Opções: [a] aceitar sugestão | [e] editar | [p] pular | [d] adiar arquivo");
    const op = (await ask("=> ")).trim().toLowerCase();

    if (op === "d") {
      // marca para depois
      const flags = new Set(normalizeArray(data.flags));
      flags.add("needs_review");
      data.flags = Array.from(flags);
      return { changed: true, deferred: true, data };
    }

    if (op === "p" || op === "") continue;

    if (op === "a") {
      if (!suggestion) {
        console.log("Sem sugestão. Use [e] para digitar.");
        continue;
      }
      canonSet.add(suggestion.toLowerCase());
      currentCanon.push(suggestion.toLowerCase());
      saveOverride(norm, suggestion);
      continue;
    }

    if (op === "e") {
      const manual = (await ask("Digite o canônico (ex: batata, tomate, cebola): ")).trim().toLowerCase();
      if (!manual) continue;
      if (!canonSet.has(manual)) {
        canonSet.add(manual);
        currentCanon.push(manual);
      }
      saveOverride(norm, manual);
      continue;
    }
  }

  // atualiza data.ingredients.list
  const newData = { ...data, ingredients: { ...(data.ingredients || {}), list: currentCanon } };

  // não reescreve o corpo aqui; somente atualiza FM para não correr risco
  const rebuilt = matter.stringify(body, newData);
  return { changed: true, deferred: false, content: rebuilt };
}

/* =========================
   RUN
   ========================= */
(async function main() {
  const targets = pickTargets().slice(0, LIMIT);

  const stats = {
    total: 0,
    ok: 0,
    needsReview: 0,
    invalid: 0,
    missingIngredients: 0,
    missingSteps: 0,
  };

  for (const filePath of targets) {
    stats.total++;

    const raw = fs.readFileSync(filePath, "utf8");
    let parsed;
    try {
      parsed = parseWithMissingStartFM(raw);
    } catch {
      parsed = { data: {}, content: raw };
    }

    if (MODE_AUDIT) {
      const a = auditOne(filePath, raw, parsed);
      const ok = a.titleOk && a.hasIngredientsComplete && a.hasSteps && !a.invalid;
      if (ok) stats.ok++;
      if (a.invalid) stats.invalid++;
      if (!a.hasIngredientsComplete) stats.missingIngredients++;
      if (!a.hasSteps) stats.missingSteps++;
      if (!ok) stats.needsReview++;

      console.log(
        `${ok ? "✅" : "⚠️"} ${path.relative(process.cwd(), filePath)} | suspeitos:${a.suspiciousIngredients} | invalid:${a.invalid ? "SIM" : "não"}`
      );
      continue;
    }

    if (MODE_AUTOFIX) {
      const fixed = buildAutofixContent(parsed, raw);

      // se for "defer" e o arquivo é claramente inválido/needs_review, apenas marca flag e segue
      if (DEFER) {
        const check = auditOne(filePath, raw, parseWithMissingStartFM(fixed));
        if (check.invalid || !check.hasIngredientsComplete || !check.hasSteps) {
          if (DRY_RUN) {
            console.log(`(dry-run) defer: ${path.relative(process.cwd(), filePath)}`);
          } else {
            fs.writeFileSync(filePath, fixed, "utf8");
            console.log(`⏭️  Defer (marcado) + autofix: ${path.relative(process.cwd(), filePath)}`);
          }
          continue;
        }
      }

      if (DRY_RUN) {
        console.log(`(dry-run) autofix: ${path.relative(process.cwd(), filePath)}`);
      } else {
        fs.writeFileSync(filePath, fixed, "utf8");
        console.log(`✅ autofix: ${path.relative(process.cwd(), filePath)}`);
      }
      continue;
    }

    if (MODE_REVIEW) {
      const res = await reviewCanonicalForFile(parsed, raw);
      if (res.deferred && DEFER) {
        // se você escolheu adiar e está em modo defer, só grava flags
        const out = matter.stringify(parsed.content || raw, res.data || parsed.data || {});
        if (!DRY_RUN) fs.writeFileSync(filePath, out, "utf8");
        console.log(`⏭️  Adiado: ${path.relative(process.cwd(), filePath)}`);
        continue;
      }

      if (res.content) {
        if (DRY_RUN) console.log(`(dry-run) review save: ${path.relative(process.cwd(), filePath)}`);
        else fs.writeFileSync(filePath, res.content, "utf8");
        console.log(`✅ review: ${path.relative(process.cwd(), filePath)}`);
      } else {
        console.log(`(nada) ${path.relative(process.cwd(), filePath)} - ${res.reason || "sem mudanças"}`);
      }
      continue;
    }
  }

  if (MODE_AUDIT) {
    console.log("\n=== RESUMO AUDIT ===");
    console.log(stats);
  }
})();
