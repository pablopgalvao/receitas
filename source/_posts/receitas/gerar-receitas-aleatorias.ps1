# Conando a ser executado

# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# .\gerar-receitas-aleatorias.ps1

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
    "Torta de Frango com Ervas",
    "Torta de Carne Moída",
    "Torta de Atum",
    "Torta de Palmito",
    "Torta de Queijo",
    "Torta de Legumes",
    "Torta de Bacon",
    "Torta de Calabresa",
    "Torta de Camarão",
    "Torta de Ricota",
    "Torta de Espinafre"
)

$categorias = @(
    "receitas",
    "culinaria",
    "comida-caseira",
    "pratos-principais",
    "lanches",
    "massas",
    "salgados",
    "tortas",
    "assados",
    "forno",
    "jantar",
    "almoço",
    "ceia",
    "festas",
    "eventos",
    "culinária-brasileira",
    "culinária-internacional",
    "dieta",
    "light",
    "fit",
    "vegetariano",
    "low-carb",
    "gluten-free",
    "lactose-free"
)

$tags = @(
    # Proteínas
    "frango", "carne", "atum", "peixe", "camarão", "bacon", "calabresa", "presunto", "queijo",
    "ovo", "ricota", "palmito", "proteína-vegetal", "tofu",
    
    # Tipos de pratos
    "torta", "salgado", "assado", "forno", "massas", "recheio", "fácil", "rápido", "caseiro",
    "cremoso", "salgado", "doce", "light", "fit", "integral", "low-carb", "vegetariano",
    "vegano", "gluten-free", "lactose-free",
    
    # Ocasiões
    "jantar", "almoço", "lanche", "ceia", "café-da-manhã", "brunch", "festas", "eventos",
    "reuniões", "aniversários", "comemorações",
    
    # Estilos culinários
    "brasileiro", "italiano", "mediterrâneo", "mexicano", "caseiro", "tradicional", "moderno",
    "contemporâneo", "gourmet", "simples",
    
    # Ingredientes principais
    "farinha", "trigo", "ovos", "leite", "queijo", "requeijão", "catupiry", "ervas", "temperos",
    "cebola", "alho", "tomate", "pimentão", "cenoura", "batata", "mandioca", "espinafre",
    "brócolis", "couve-flor", "legumes", "vegetais",
    
    # Métodos de preparo
    "assado", "forno", "liquidificador", "fácil-preparo", "rápido-preparo", "passo-a-passo",
    "dica-culinária", "técnica-culinária"
)

$imagens = @(
    # Tortas de Frango
    "https://img.freepik.com/fotos-gratis/fatia-de-torta-de-frango-cremosa-servida-em-prato_123827-34567.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-frango-caseira_23-2148742325.jpg",
    "https://img.freepik.com/fotos-gratis/deliciosa-torta-de-frango-em-um-prato_23-2148742323.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-frango-cremosa_23-2148742320.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-frango-tradicional_23-2148742318.jpg",
    
    # Tortas de Carne
    "https://img.freepik.com/fotos-gratis/torta-de-carne-moida_23-2148742330.jpg",
    "https://img.freepik.com/fotos-gratis/torta-salgada-de-carne_23-2148742328.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-carne-caseira_23-2148742327.jpg",
    
    # Tortas de Queijo e Vegetais
    "https://img.freepik.com/fotos-gratis/torta-de-queijo_23-2148742335.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-ricota_23-2148742333.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-legumes_23-2148742332.jpg",
    "https://img.freepik.com/fotos-gratis/torta-vegetariana_23-2148742338.jpg",
    
    # Tortas de Frutos do Mar
    "https://img.freepik.com/fotos-gratis/torta-de-atum_23-2148742340.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-camarao_23-2148742342.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-palmito_23-2148742345.jpg",
    
    # Tortas Diversas
    "https://img.freepik.com/fotos-gratis/torta-de-bacon_23-2148742348.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-calabresa_23-2148742350.jpg",
    "https://img.freepik.com/fotos-gratis/torta-de-espinafre_23-2148742352.jpg",
    "https://img.freepik.com/fotos-gratis/torta-light_23-2148742355.jpg",
    "https://img.freepik.com/fotos-gratis/torta-integral_23-2148742358.jpg"
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
for ($i = 1; $i -le 210; $i++) {
    # Gerar valores aleatórios
    $randomTitulo = $titulos | Get-Random
    $randomCategorias = Get-RandomCombination -Array $categorias -Count (Get-Random -Minimum 1 -Maximum 4)
    $randomTags = Get-RandomCombination -Array $tags -Count (Get-Random -Minimum 3 -Maximum 8)
    $randomImagem = $imagens | Get-Random
    
    # Adicionar numeração ao título e nome do arquivo
    $tituloComNumero = "$randomTitulo #$i"
    $fileName = "$baseFileName$i.md"
    $filePath = Join-Path $outputDir $fileName
    
    # Substituir os valores no template
    $content = $template -replace "title: Torta de Frango Cremosa", "title: $tituloComNumero"
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