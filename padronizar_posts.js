const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const postsDir = './source/_posts/receitas';  // ajuste para o seu diretório de posts

fs.readdir(postsDir, (err, files) => {
  if (err) throw err;

  files.forEach(file => {
    if (path.extname(file) === '.md') {
      const filePath = path.join(postsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      // Detecta se já existe front-matter
      let parsed = {};
      try {
        parsed = matter(content);
      } catch (e) {
        // Se erro, considera todo o arquivo como body
        parsed = { data: {}, content };
      }

      const body = parsed.content.trim();

      // Extrai informações do padrão antigo "**Informações:**"
      const infoMatch = body.match(/\*\*Informações:\*\*([\s\S]*?)\n\n/);
      let info = {};
      if (infoMatch) {
        const lines = infoMatch[1].split('\n').map(l => l.replace(/^- /, '').trim());
        lines.forEach(l => {
          const [key, ...rest] = l.split(':');
          if (key && rest) info[key.toLowerCase()] = rest.join(':').trim();
        });
      }

      // Extrai categorias e tags antigas (opcional)
      const categoriesMatch = body.match(/\*\*Categorias:\*\*([\s\S]*?)\n\n/);
      const tagsMatch = body.match(/\*\*Tags:\*\*([\s\S]*?)\n\n/);
      const categories = categoriesMatch ? categoriesMatch[1].split(',').map(c => c.trim()).filter(Boolean) : parsed.data.categories || [];
      const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : parsed.data.tags || [];

      // Front-matter padronizado
      const newData = {
        title: parsed.data.title || body.split('\n')[0].replace(/^# /, '').trim() || 'Nova Receita',
        categories: categories.length ? categories : ['receitas'],
        tags: tags.length ? tags : [],
        ingredients: parsed.data.ingredients || [],
        difficulty: parsed.data.difficulty || info['dificuldade'] || 'fácil',
        time: parsed.data.time || info['tempo'] || '',
        servings: parsed.data.servings || info['porções'] || '',
        calories: parsed.data.calories || info['calorias'] || '',
        author: parsed.data.author || info['autor'] || 'Autor',
        date: parsed.data.date || (info['data'] ? new Date(info['data']).toISOString() : new Date().toISOString())
      };

      // Mantém a imagem existente ou adiciona placeholder
      let newBody = body.replace(/\*\*Informações:\*\*([\s\S]*?)\n\n/, '');
      newBody = newBody.replace(/\*\*Categorias:\*\*([\s\S]*?)\n\n/, '');
      newBody = newBody.replace(/\*\*Tags:\*\*([\s\S]*?)\n\n/, '');
      if (!/!\[.*\]\(.*\)/.test(newBody)) {
        newBody = '![Imagem exemplo](css/images/imagem-exemplo/imagem-exemplo.jpg)\n\n' + newBody;
      }

      // Garante seções de Ingredientes e Modo de Preparo
      if (!/## Ingredientes/i.test(newBody)) {
        newBody = '## Ingredientes\n- Ingrediente 1  \n\n' + newBody;
      }
      if (!/## Modo de Preparo/i.test(newBody)) {
        newBody += '\n\n## Modo de Preparo\n1. Passo 1  \n2. Passo 2  \n3. Passo 3';
      }

      const finalContent = matter.stringify(newBody, newData);
      fs.writeFileSync(filePath, finalContent, 'utf8');
      console.log(`Post padronizado: ${file}`);
    }
  });
});
