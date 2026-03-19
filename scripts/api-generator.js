const fs = require('fs');
const path = require('path');

function toAbsoluteUrlFactory(baseUrl, rootPath) {
  return (url) => {
    if (!url) return "";
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return baseUrl + url;
    return baseUrl + '/' + url;
  };
}

function serializePost(post, toAbsoluteUrl, rootPath) {
  const imageRegex = /<img[^>]+src="([^">]+)"[^>]*>/g;
  const videoRegex = /<a[^>]+href="(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>/g;

  const images = [];
  const videos = [];
  let match;

  while ((match = imageRegex.exec(post.content)) !== null) {
    images.push(toAbsoluteUrl(match[1]));
  }

  while ((match = videoRegex.exec(post.content)) !== null) {
    videos.push(match[1]);
  }

  const postImage = post.image
    ? toAbsoluteUrl(post.image)
    : (images.length > 0
        ? images[0]
        : 'https://plus.unsplash.com/premium_vector-1713364393085-0fdda13ec7cd?q=80&w=727&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D');

  return {
    id: post._id,
    title: post.title,
    url: toAbsoluteUrl(rootPath + post.path),
    api_url: toAbsoluteUrl(`${rootPath}api/receitas/${post._id}.json`),
    deeplink: `boil://receita?rid=${post._id}`,
    image: postImage,
    images,
    videos,
    slug: post.slug,
    date: post.date,
    ingredients: post.ingredients || [],
    difficulty: post.difficulty || '',
    time: post.time || '',
    servings: post.servings || '',
    calories: post.calories || '',
    author: post.author || '',
    categories: post.categories ? post.categories.toArray().map(cat => cat.name) : [],
    tags: post.tags ? post.tags.toArray().map(tag => tag.name) : [],
    excerpt: post.excerpt,
    content: post.content
  };
}

hexo.extend.generator.register('api-receitas', function(locals) {
  const baseUrl = this.config.url;
  const rootPath = this.config.root;
  const toAbsoluteUrl = toAbsoluteUrlFactory(baseUrl, rootPath);

  const receitas = locals.posts
    .filter(post => post.categories && post.categories.toArray().length > 0)
    .sort((postA, postB) => {
      const dateA = postA.date ? new Date(postA.date).getTime() : 0;
      const dateB = postB.date ? new Date(postB.date).getTime() : 0;
      return dateB - dateA;
    })
    .map(post => serializePost(post, toAbsoluteUrl, rootPath));

  return {
    path: 'api/receitas.json',
    data: JSON.stringify({
      count: receitas.length,
      receitas
    }, null, 2)
  };
});

hexo.extend.generator.register('api-receitas-por-id', function(locals) {
  const baseUrl = this.config.url;
  const rootPath = this.config.root;
  const toAbsoluteUrl = toAbsoluteUrlFactory(baseUrl, rootPath);

  return locals.posts
    .filter(post => post.categories && post.categories.toArray().length > 0)
    .map(post => ({
      path: `api/receitas/${post._id}.json`,
      data: JSON.stringify(
        serializePost(post, toAbsoluteUrl, rootPath),
        null,
        2
      )
    }));
});