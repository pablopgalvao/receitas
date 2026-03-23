function toAbsoluteUrlFactory(baseUrl, rootPath) {
  return (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${baseUrl}${url}`;
    return `${baseUrl}/${url}`;
  };
}

function stripHtml(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeText(text = '') {
  return stripHtml(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .trim();
}

function uniqueArray(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function extractImagesFromContent(content, toAbsoluteUrl) {
  const imageRegex = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi;
  const images = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    images.push(toAbsoluteUrl(match[1]));
  }

  return uniqueArray(images);
}

function extractVideosFromContent(content, toAbsoluteUrl) {
  const videos = [];

  const anchorVideoRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

  const iframeVideoRegex =
    /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;

  const videoFileRegex =
    /<video[^>]*>([\s\S]*?)<\/video>/gi;

  const sourceInsideVideoRegex =
    /<source[^>]+src=["']([^"']+)["'][^>]*>/gi;

  let match;

  while ((match = anchorVideoRegex.exec(content)) !== null) {
    const url = match[1];
    if (
      /youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|tiktok\.com|vimeo\.com|\.mp4(\?|$)|\.webm(\?|$)|\.mov(\?|$)/i.test(
        url
      )
    ) {
      videos.push(toAbsoluteUrl(url));
    }
  }

  while ((match = iframeVideoRegex.exec(content)) !== null) {
    const url = match[1];
    if (
      /youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|tiktok\.com|vimeo\.com/i.test(
        url
      )
    ) {
      videos.push(toAbsoluteUrl(url));
    }
  }

  while ((match = videoFileRegex.exec(content)) !== null) {
    const block = match[1];
    let sourceMatch;
    while ((sourceMatch = sourceInsideVideoRegex.exec(block)) !== null) {
      videos.push(toAbsoluteUrl(sourceMatch[1]));
    }
  }

  return uniqueArray(videos);
}

function matchSection(content, startPattern, endPattern) {
  const regex = new RegExp(
    `${startPattern}([\\s\\S]*?)${endPattern}`,
    'i'
  );
  const match = content.match(regex);
  return match ? match[1] : '';
}

function extractListItems(sectionHtml = '') {
  const items = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = liRegex.exec(sectionHtml)) !== null) {
    const text = normalizeText(match[1]);
    if (text) items.push(text);
  }

  return items;
}

function extractOrderedSteps(sectionHtml = '') {
  const olMatch = sectionHtml.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
  const sourceHtml = olMatch ? olMatch[1] : sectionHtml;
  return extractListItems(sourceHtml);
}

function extractIngredientsAndStepsFromContent(content = '') {
  const ingredientsSection = matchSection(
    content,
    '(?:<h[1-6][^>]*>[\\s\\S]*?Ingredientes[\\s\\S]*?<\\/h[1-6]>|Ingredientes)',
    '(?:<hr[^>]*>|<h[1-6][^>]*>[\\s\\S]*?Modo de Preparo[\\s\\S]*?<\\/h[1-6]>|Modo de Preparo)'
  );

  const stepsSection = matchSection(
    content,
    '(?:<h[1-6][^>]*>[\\s\\S]*?Modo de Preparo[\\s\\S]*?<\\/h[1-6]>|Modo de Preparo)',
    '(?:<hr[^>]*>|<h[1-6][^>]*>[\\s\\S]*?(?:Dicas|Observações|Informações Nutricionais|Notas)[\\s\\S]*?<\\/h[1-6]>|$)'
  );

  const ingredients = extractListItems(ingredientsSection);
  const steps = extractOrderedSteps(stepsSection);

  return {
    ingredients,
    steps,
  };
}

function buildExcerpt(title, ingredients, steps, time) {
  const firstIngredient = ingredients[0] || '';
  const firstStep = steps[0] || '';

  const parts = [
    title ? `${title}.` : '',
    time ? `Tempo de preparo: ${time}.` : '',
    firstIngredient ? `Ingrediente em destaque: ${firstIngredient}.` : '',
    firstStep ? `Comece assim: ${firstStep}` : '',
  ].filter(Boolean);

  return parts.join(' ').trim();
}

function buildHashtags(post) {
  return uniqueArray([
    '#receitas',
    '#culinaria',
    '#larDochef',
    ...(post.tags
      ? post.tags.toArray().map((tag) => `#${String(tag.name).replace(/\s+/g, '')}`)
      : []),
  ]);
}

function buildSocialData(post, ingredients, steps) {
  const captionShort = post.title || '';

  const captionMedium = [
    post.title || '',
    ingredients.length ? `Ingredientes: ${ingredients.slice(0, 5).join(', ')}.` : '',
    steps[0] ? `Modo de preparo: ${steps[0]}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    caption_short: captionShort,
    caption_medium: captionMedium,
    hashtags: buildHashtags(post),
  };
}
function getPublicId(post) {
  return post.id || post._id;
}

function serializePost(post, toAbsoluteUrl, rootPath) {
  const publicId = getPublicId(post);
  const content = post.content || '';
  const images = extractImagesFromContent(content, toAbsoluteUrl);
  const videos = extractVideosFromContent(content, toAbsoluteUrl);
  const { ingredients, steps } = extractIngredientsAndStepsFromContent(content);

  const postImage = post.image
    ? toAbsoluteUrl(post.image)
    : (images[0] || '');

  const social = buildSocialData(post, ingredients, steps);
  const effectiveSlug = getEffectiveSlug(post);

  return {
    id: publicId,
    title: post.title || '',
    slug: effectiveSlug,
    url: toAbsoluteUrl(`${rootPath}${post.path}`),
    api_url: toAbsoluteUrl(`${rootPath}api/receitas/${publicId}.json`),
    social_api_url: toAbsoluteUrl(`${rootPath}api/social-posts/${publicId}.json`),
    deeplink: `boil://receita?rid=${publicId}`,
    image: postImage,
    images,
    videos,
    media: {
      image: postImage,
      images,
      videos,
      has_image: images.length > 0 || !!postImage,
      has_video: videos.length > 0,
      preferred_type: videos.length > 0 ? 'video' : 'image',
      preferred_url: videos[0] || postImage || images[0] || '',
    },
    date: post.date || null,
    updated: post.updated || null,
    time: post.time || '',
    difficulty: post.difficulty || '',
    servings: post.servings || '',
    calories: post.calories || '',
    author: post.author || 'Lar do chef',
    categories: post.categories ? post.categories.toArray().map((cat) => cat.name) : [],
    tags: post.tags ? post.tags.toArray().map((tag) => tag.name) : [],
    ingredients,
    steps,
    excerpt: normalizeText(post.excerpt || '') || buildExcerpt(post.title, ingredients, steps, post.time),
    social,
    content,
  };
}

function serializeSocialPost(post, toAbsoluteUrl, rootPath) {
  const fullPost = serializePost(post, toAbsoluteUrl, rootPath);

  return {
    id: fullPost.id,
    title: fullPost.title,
    slug: fullPost.slug,
    url: fullPost.url,
    deeplink: fullPost.deeplink,
    date: fullPost.date,

    image: fullPost.image,
    images: fullPost.images,
    videos: fullPost.videos,
    media: fullPost.media,

    ingredients: fullPost.ingredients,
    steps: fullPost.steps,

    social: fullPost.social,
  };
}

function getRecipePosts(locals) {
  return locals.posts
    .filter((post) => post.categories && post.categories.toArray().length > 0)
    .sort((postA, postB) => {
      const dateA = postA.date ? new Date(postA.date).getTime() : 0;
      const dateB = postB.date ? new Date(postB.date).getTime() : 0;
      return dateB - dateA;
    });
}

hexo.extend.generator.register('api-receitas-por-id', function (locals) {
  const baseUrl = this.config.url;
  const rootPath = this.config.root;
  const toAbsoluteUrl = toAbsoluteUrlFactory(baseUrl, rootPath);

  return getRecipePosts(locals).map((post) => {
    const publicId = getPublicId(post);

    return {
      path: `api/receitas/${publicId}.json`,
      data: JSON.stringify(
        serializePost(post, toAbsoluteUrl, rootPath),
        null,
        2
      ),
    };
  });
});

hexo.extend.generator.register('api-social-posts-por-id', function (locals) {
  const baseUrl = this.config.url;
  const rootPath = this.config.root;
  const toAbsoluteUrl = toAbsoluteUrlFactory(baseUrl, rootPath);

  return getRecipePosts(locals).map((post) => {
    const publicId = getPublicId(post);

    return {
      path: `api/social-posts/${publicId}.json`,
      data: JSON.stringify(
        serializeSocialPost(post, toAbsoluteUrl, rootPath),
        null,
        2
      ),
    };
  });
});

hexo.extend.generator.register('api-social-posts', function (locals) {
  const baseUrl = this.config.url;
  const rootPath = this.config.root;
  const toAbsoluteUrl = toAbsoluteUrlFactory(baseUrl, rootPath);

  const posts = getRecipePosts(locals).map((post) =>
    serializeSocialPost(post, toAbsoluteUrl, rootPath)
  );

  return {
    path: 'api/social-posts.json',
    data: JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        count: posts.length,
        posts,
      },
      null,
      2
    ),
  };
});

hexo.extend.generator.register('recipe-routes', function (locals) {
  const routes = {};
  const duplicateSlugs = {};

  getRecipePosts(locals).forEach((post) => {
    const publicId = getPublicId(post);
    const slug = getEffectiveSlug(post);

    if (!slug || !publicId) return;

    const rootPath = this.config.root || '/';
    const url = `${rootPath}${slug}/${publicId}/`;

    if (routes[slug]) {
      duplicateSlugs[slug] = duplicateSlugs[slug] || [routes[slug]];
      duplicateSlugs[slug].push(url);
      delete routes[slug];
      return;
    }

    if (!duplicateSlugs[slug]) {
      routes[slug] = url;
    }
  });

  return [
    {
      path: 'recipe-routes.json',
      data: JSON.stringify(routes, null, 2),
    },
    {
      path: 'recipe-routes-duplicates.json',
      data: JSON.stringify(duplicateSlugs, null, 2),
    },
  ];
});

hexo.extend.generator.register('api-receitas', function (locals) {
  const baseUrl = this.config.url;
  const rootPath = this.config.root;
  const toAbsoluteUrl = toAbsoluteUrlFactory(baseUrl, rootPath);

  const receitas = getRecipePosts(locals).map((post) =>
    serializePost(post, toAbsoluteUrl, rootPath)
  );

  return {
    path: 'api/receitas.json',
    data: JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        count: receitas.length,
        receitas,
      },
      null,
      2
    ),
  };
});

function trimSlashes(value = '') {
  return String(value).replace(/^\/+|\/+$/g, '');
}

function getEffectiveSlug(post) {
  if (post.slug) return String(post.slug).trim();

  if (post.path) {
    const parts = trimSlashes(post.path).split('/').filter(Boolean);

    // Ex.: receitas/ab_bora_assada_com_alho_e_s_lvia/cmm....../index.html
    const indexPos = parts.lastIndexOf('index.html');
    if (indexPos > 1) {
      return parts[indexPos - 2] || '';
    }

    // Ex.: receitas/slug/id/
    if (parts.length >= 2) {
      return parts[parts.length - 2] || '';
    }
  }

  if (post.permalink) {
    const parts = trimSlashes(post.permalink).split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 2] || '';
    }
  }

  return '';
}