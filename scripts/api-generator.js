const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('api-receitas', function(locals) {
  const receitas = locals.posts.filter(post => 
    post.categories && post.categories.toArray().some(cat => cat.name === 'receitas')
  ).map(post => ({
    id: post._id,
    title: post.title,
    image: post.image || '../prato.jpg', 
    slug: post.slug,
    date: post.date,
    ingredients: post.ingredients || [],
    difficulty: post.difficulty || '',
    time: post.time || '',
    servings: post.servings || '',
    calories: post.calories || '',
    categories: post.categories ? post.categories.toArray().map(cat => cat.name) : [],
    tags: post.tags ? post.tags.toArray().map(tag => tag.name) : [],
    excerpt: post.excerpt,
    content: post.content
  }));

  return {
    path: 'api/receitas.json',
    data: JSON.stringify({
      count: receitas.length,
      receitas: receitas
    }, null, 2)
  };
});