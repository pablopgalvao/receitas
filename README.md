# receitas

Headless baseado em Hexo CMS para criação e publicação de receitas.

Este projeto já vem configurado com temas e plugins do Hexo e inclui um utilitário de linha de comando (`receitas-cli`) para padronizar e revisar receitas em massa.

## Pré-requisitos
- **Node.js**: 18+ recomendado
- **Git**: para deploy via `hexo-deployer-git` (opcional)

Instale as dependências:

```bash
npm install
```

## Comandos Hexo
Você pode usar diretamente os scripts do projeto ou o `npx hexo`.

- **Servidor de desenvolvimento**: inicia em http://localhost:4000
	- `npm run server`
	- ou `npx hexo server --watch`
	- Para mudar a porta:
	- `hexo server -p 5000`
	- ou
	- `hexo s -p 5000`

- **Criar conteúdo**:
	- Post padrão: `npx hexo new post "Título da Receita"`
	- Página: `npx hexo new page "Sobre"`
	- Layout customizado de receita (usa [scaffolds/receita.md](scaffolds/receita.md)):
		- `npx hexo new receita "Título da Receita"`

- **Build estático**: gera arquivos em `public/`
	- `npm run build`
	- ou `npx hexo generate`

- **Limpar cache/arquivos gerados**:
	- `npm run clean`
	- ou `npx hexo clean`

- **Deploy (git)**:
	- `npm run deploy`
	- ou `npx hexo deploy`
	- Requer configuração de `hexo-deployer-git` em `_config.yml` (branch/remoto).

### Estrutura relevante
- Posts publicados: `source/_posts/receitas`
- Rascunhos: `source/_drafts/receitas`
- Saída gerada: `public/`

## receitas-cli
Ferramenta para auditar, organizar e revisar receitas. Arquivo: [receitas-cli.js](receitas-cli.js)

### O que ele faz
- Lê receitas em `source/_drafts/receitas` e/ou `source/_posts/receitas`
- Gera/organiza o corpo no modelo padrão (sem perder conteúdo)
- Normaliza metadados básicos (tempo, categorias, flags)
- Suporta revisão interativa de `ingredients.list` (canônicos)

### Modos
- `--audit`: só analisa, não altera arquivos. Mostra estatísticas por arquivo.
- `--autofix`: padroniza o esqueleto e normaliza metadados, preservando todo o conteúdo.
- `--review`: revisão interativa de canônicos (`ingredients.list`) sem mexer na lista completa do corpo.
- `--optimize-images`: otimiza imagens APENAS de `source/images/_restored_from_crawler` (standalone).

### Alvos
- `--drafts`  Processa apenas rascunhos
- `--posts`   Processa apenas publicados
- `--all`     Processa ambos (padrão se nenhum alvo for passado)

### Extras
- `--defer`       Em revisão, adia decisões e marca `needs_review`
- `--limit N`     Limita a N arquivos no lote
- `--dry-run`     Não grava arquivos (visualização/validação)

### Otimização de imagens (standalone)
Este modo reduz o tamanho das imagens que foram restauradas do crawler.

Requisitos:
- **ImageMagick** instalado e comando `magick` disponível no PATH (Windows: `winget install ImageMagick.ImageMagick`).

Comportamento padrão:
- Lê imagens em `source/images/_restored_from_crawler`
- Gera versões `.webp` otimizadas em `source/images/_restored_from_crawler_optimized`
- Não sobrescreve originais

Parâmetros:
- `--quality N` (padrão: 82)
- `--max-width N` (padrão: 1600)
- `--in-place` sobrescreve em `_restored_from_crawler` e salva backup em `_restored_from_crawler/_backup_originals`

### Exemplos (Windows PowerShell)
```powershell
# Auditar tudo sem alterar
node receitas-cli.js --audit --all

# Padronizar apenas posts, limitando a 50 arquivos
node receitas-cli.js --autofix --posts --limit 50

# Revisão interativa de rascunhos; adiar quando estiver em dúvida
node receitas-cli.js --review --drafts --defer

# Testar mudanças sem gravar
node receitas-cli.js --autofix --all --dry-run

# Otimizar imagens restauradas (gera .webp em pasta separada)
node receitas-cli.js --optimize-images

# Otimizar imagens restauradas substituindo (com backup)
node receitas-cli.js --optimize-images --in-place
```

### Notas e flags
- O autofix pode marcar `invalid_source` (parece peça publicitária) e `needs_review` (ingredientes ou preparo ausentes).
- `ingredients.list` armazena ingredientes canônicos em minúsculas; o corpo mantém a lista completa original.

## Dicas
- Use `--limit` e `--dry-run` para validar o resultado em pequenos lotes antes de aplicar em massa.
- Após grandes mudanças, rode `npm run clean && npm run build` para garantir que a saída está consistente.
