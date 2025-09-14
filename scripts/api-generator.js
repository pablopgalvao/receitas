const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('api-receitas', function(locals) {
  const receitas = locals.posts.filter(post => 
    post.categories && post.categories.toArray().some(cat => cat.name === 'receitas')
  ).map(post => {
    // Extrair imagens do conteúdo HTML
    const imageRegex = /<img[^>]+src="([^">]+)"[^>]*>/g;
    const videoRegex = /<a[^>]+href="(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"]*)"[^>]*>/g;
    
    const images = [];
    const videos = [];
    let match;
    
    // Extrair imagens do HTML
    while ((match = imageRegex.exec(post.content)) !== null) {
      images.push(match[1]);
    }
    
    // Extrair vídeos do YouTube
    while ((match = videoRegex.exec(post.content)) !== null) {
      videos.push(match[1]);
    }
    
    // Usar a primeira imagem encontrada como imagem principal
    const postImage = images.length > 0 ? images[0] : (post.image || 'https://plus.unsplash.com/premium_vector-1713364393085-0fdda13ec7cd?q=80&w=727&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D');
    
    return {
      id: post._id,
      title: post.title,
      image: postImage,
      images: images,
      videos: videos,
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