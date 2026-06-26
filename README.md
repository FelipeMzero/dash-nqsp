# Dashboard NQSP — Não Conformidades

**Núcleo de Qualidade e Segurança do Paciente — HRMJ**

Dashboard interativo para análise de registros de não conformidades, exportado do sistema **SAS Interact**. Visualização estilo **Google Looker Studio** com gráficos, filtros, métricas e exportação de relatórios.

## Funcionalidades

- **Upload de CSV** — Arraste ou selecione o arquivo CSV exportado do Interact
- **Filtros** — Por setor, turno e período (datepicker customizado)
- **5 Métricas** — Total de registros, status concluído/pendente, setores envolvidos, período dos dados
- **9 Gráficos:**
  - Status (tabela + gráfico de rosca)
  - Setor Notificado (barras)
  - Setor Notificador (barras)
  - Linha do Tempo (Registros vs. Ocorrências por mês com % de variação)
  - Classificação da Ocorrência (barras)
  - Tipo de Não Conformidade (barras)
  - Impacto no Processo (rosca)
  - Consequência do Dano (rosca)
  - Classificação do Risco (barras coloridas)
- **Zoom nos gráficos** — Clique no cabeçalho de qualquer card para expandir
- **Comparação mensal** — Na view expandida da linha do tempo, selecione dois meses para comparar registros vs. ocorrências com variação percentual
- **Exportação** — PDF (alta qualidade) e PNG
- **Nome do relatório** — Campo editável usado como nome do arquivo exportado

## Como usar

1. Acesse `index.html`
2. Faça upload do arquivo CSV exportado do Interact (delimitador `;`)
3. O dashboard abrirá automaticamente em uma nova aba
4. Use os filtros de setor, turno e período para segmentar os dados
5. Clique em **"Aplicar"** para atualizar os gráficos
6. Para exportar, use as opções no menu lateral: **Exportar PDF** ou **Exportar Imagem**
7. Para comparar meses específicos, clique no card **"Linha do Tempo"**, selecione mês inicial e final e clique em **"Comparar"**

## Formato do CSV

O sistema espera um CSV com delimitador `;` e codificação UTF-8 (compatível com ISO-8859-1/Win-1252). 
Colunas normalizadas automaticamente:
- `Data de Registro` ou `Criado em` — para linha do tempo
- `Data do Ocorrido` — para comparação com incidentes
- `Setor Notificado`, `Setor Notificante`, `Turno do Ocorrido:`
- `Status`, `Classificação da Ocorrência`, `Tipo de Não Conformidade`
- `Impacto no Processo`, `Consequência do dano`, `Classificação do Risco`

## Tecnologias

- HTML / CSS (Design System Looker Studio)
- JavaScript vanilla
- [Chart.js](https://www.chartjs.org/) + plugin DataLabels
- [PapaParse](https://www.papaparse.com/) — parsing de CSV
- [html2canvas](https://html2canvas.hertzen.com/) — captura de tela
- [jsPDF](https://github.com/parallax/jsPDF) — geração de PDF
- [Google Fonts (Outfit)](https://fonts.google.com/specimen/Outfit)

## Licença

Uso interno — HRMJ / SESPA
