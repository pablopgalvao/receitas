const { execSync } = require('child_process');

// Gerar site estático
execSync('hexo generate', { stdio: 'inherit' });

// Copiar API para pasta pública
const fs = require('fs');
const apiData = require('./public/api/receitas.json');
fs.writeFileSync('./public/api/v1/receitas.json', JSON.stringify(apiData, null, 2));