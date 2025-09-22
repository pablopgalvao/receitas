# Comando

# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# .\gerar-receitas.ps1

# Configurações
$sourceFile = "feijoada_simples.md"  # Arquivo deve estar no diretório atual
$outputDir = "."  # Diretório atual
$baseFileName = "exemplo-"

# Listas para variação dos campos
$titulos = @(
    "Receita de Exemplo",
    "Receita de Exemplo com Requeijão",
    "Receita de Exemplo Especial",
    "Receita de Exemplo Caseira",
    "Receita de Exemplo da Vó",
    "Receita de Exemplo com Catupiry",
    "Receita de Exemplo Light",
    "Receita de Exemplo Fit",
    "Receita de Exemplo Integral",
    "Receita de Exemplo com Ervas"
)

$categorias = @(
    "receitas",
    "culinaria",
    "comida-caseira",
    "pratos-principais",
    "lanches"
)

$tags = @(
    "frango",
    "torta",
    "fácil",
    "rápido",
    "caseiro",
    "cremoso",
    "salgado",
    "jantar",
    "almoço",
    "lanche"
)

$imagens = @(
    "https://img.freepik.com/fotos-gratis/fatia-de-torta-de-frango-cremosa-servida-em-prato_123827-34567.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-frango-caseira_23-2148742325.jpg",
    "https://img.freepik.com/fotos-gratis/deliciosa-torta-de-frango-em-um-prato_23-2148742323.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-frango-cremosa_23-2148742320.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-frango-tradicional_23-2148742318.jpg"
)

# Função para gerar combinações aleatórias
function Get-RandomCombination {
    param($Array, $Count)
    $Array | Get-Random -Count $Count | Sort-Object
}

# Verificar se o arquivo modelo existe
if (-not (Test-Path $sourceFile)) {
    Write-Host "Erro: Arquivo modelo '$sourceFile' não encontrado!" -ForegroundColor Red
    exit
}

# Ler o arquivo modelo
$template = Get-Content -Path $sourceFile -Raw

# Criar 150 arquivos
for ($i = 1; $i -le 150; $i++) {
    # Gerar valores aleatórios
    $randomTitulo = $titulos | Get-Random
    $randomCategorias = Get-RandomCombination -Array $categorias -Count (Get-Random -Minimum 1 -Maximum 4)
    $randomTags = Get-RandomCombination -Array $tags -Count (Get-Random -Minimum 2 -Maximum 6)
    $randomImagem = $imagens | Get-Random
    
    # Adicionar numeração ao título e nome do arquivo
    $tituloComNumero = "$randomTitulo #$i"
    $fileName = "$baseFileName$i.md"
    $filePath = Join-Path $outputDir $fileName
    
    # Substituir os valores no template
    $content = $template -replace "title: Receita de Exemplo", "title: $tituloComNumero"
    $content = $content -replace "categories:`r`n  - receitas`r`n  - salgados", "categories:`r`n$(($randomCategorias | ForEach-Object {"  - $_"}) -join "`r`n")"
    $content = $content -replace "tags:`r`n  - frango`r`n  - torta`r`n  - fácil", "tags:`r`n$(($randomTags | ForEach-Object {"  - $_"}) -join "`r`n")"
    $content = $content -replace "https://img.freepik.com/fotos-gratis/fatia-de-torta-de-frango-cremosa-servida-em-prato_123827-34567.jpg", $randomImagem
    
    # Atualizar a data para ser única em cada arquivo
    $dataAtual = (Get-Date).AddDays($i).ToString("yyyy-MM-dd 00:00:00")
    $content = $content -replace "date: 2024-01-20 00:00:00", "date: $dataAtual"
    
    # Salvar o arquivo
    try {
        $content | Out-File -FilePath $filePath -Encoding UTF8
        Write-Host "Criado: $fileName - $tituloComNumero" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao criar $fileName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nProcesso concluído! 150 arquivos criados no diretório atual." -ForegroundColor Cyan
Write-Host "Cada arquivo possui numeração única no título e no nome do arquivo." -ForegroundColor Cyan