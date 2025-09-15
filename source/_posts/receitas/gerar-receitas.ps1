# Comando

###### Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
 .\gerar-receitas.ps1

# Configurações
$sourceFile = "torta-de-frango.md"  # Arquivo deve estar no diretório atual
$outputDir = "."  # Diretório atual
$baseFileName = "torta-"

# Listas para variação dos campos
$titulos = @(
    "Torta de Frango Cremosa",
    "Torta de Frango com Requeijão",
    "Torta de Frango Especial",
    "Torta de Frango Caseira",
    "Torta de Frango Cremosa da Vó",
    "Torta de Frango com Catupiry",
    "Torta de Frango Light",
    "Torta de Frango Fit",
    "Torta de Frango Integral",
    "Torta de Frango com Ervas"
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
for ($i = 1; $i -le 1150; $i++) {
    # Gerar valores aleatórios
    $randomTitulo = $titulos | Get-Random
    $randomCategorias = Get-RandomCombination -Array $categorias -Count (Get-Random -Minimum 1 -Maximum 4)
    $randomTags = Get-RandomCombination -Array $tags -Count (Get-Random -Minimum 2 -Maximum 6)
    $randomImagem = $imagens | Get-Random
    
    # Gerar nome do arquivo
    $fileName = "$baseFileName$i.md"
    $filePath = Join-Path $outputDir $fileName
    
    # Substituir os valores no template
    $content = $template -replace "title: Torta de Frango Cremosa", "title: $randomTitulo"
    $content = $content -replace "categories:`r`n  - receitas`r`n  - salgados", "categories:`r`n$(($randomCategorias | ForEach-Object {"  - $_"}) -join "`r`n")"
    $content = $content -replace "tags:`r`n  - frango`r`n  - torta`r`n  - fácil", "tags:`r`n$(($randomTags | ForEach-Object {"  - $_"}) -join "`r`n")"
    $content = $content -replace "https://img.freepik.com/fotos-gratis/fatia-de-torta-de-frango-cremosa-servida-em-prato_123827-34567.jpg", $randomImagem
    
    # Salvar o arquivo
    try {
        $content | Out-File -FilePath $filePath -Encoding UTF8
        Write-Host "Criado: $fileName" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao criar $fileName : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nProcesso concluído! Arquivos criados no diretório atual." -ForegroundColor Cyan