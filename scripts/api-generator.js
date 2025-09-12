const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('api-receitas', function(locals) {
  const receitas = locals.posts.filter(post => 
    post.categories && post.categories.toArray().some(cat => cat.name === 'receitas')
  ).map(post => {
    // Extrair a imagem do conteúdo do post usando regex
    const imageRegex = /!\[.*?\]\((.*?)\)/;
    const imageMatch = post.content.match(imageRegex);
    const postImage = imageMatch ? imageMatch[1] : null;
    
    return {
      id: post._id,
      title: post.title,
      image: postImage || post.image || 'https://plus.unsplash.com/premium_vector-1713364393085-0fdda13ec7cd?q=80&w=727&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
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
  });

  return {
    path: 'api/receitas.json',
    data: JSON.stringify({
      count: receitas.length,
      receitas: receitas
    }, null, 2)
  };
});