# VegetalLab Soja — versão independente 4.1.0

## Abrir no computador

Abra `index.html` em um navegador atualizado. Não é necessário instalar nada, executar servidor ou acessar a internet. O HTML contém JavaScript, estilos, desenhos SVG e bibliotecas. A interface começa no dia 0.

Use **Importar JSON** para abrir exportações Soja V4 (`schemaVersion: 4`, ciclo de 120 dias). A importação valida solo e condições e recalcula o histórico pelo modelo incluído. Arquivos são processados localmente e não são enviados a um servidor. Exportar JSON salva o estado, condições e histórico.

## Publicar no GitHub Pages

1. Crie ou abra o repositório de destino.
2. Envie os arquivos desta pasta para a raiz do repositório. O `index.html` deve ficar diretamente na raiz, e não dentro de uma subpasta `vegetallab-soja`.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch que recebeu os arquivos (normalmente `main`) e **/(root)**. Clique **Save**.
6. Aguarde a publicação. O endereço confirmado aparecerá nessa mesma página.

Para publicar o site basta `index.html`. Recomenda-se incluir também `.nojekyll` e `THIRD_PARTY_NOTICES.txt`. Os demais arquivos servem para manter e reconstruir o projeto. Não é necessário GitHub Actions nem servidor de aplicação.

Documentação oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Manutenção do código

`src/` contém a interface, a ilustração SVG, o modelo hídrico e a validação da importação. `build.cjs` gera novamente `index.html`, incorporando as bibliotecas. Para desenvolvedores, com Node.js e npm instalados:

```
npm install
npm run build
```

Depois, atualize `index.html` no repositório. A instalação só é necessária para alterar o código; visitantes não instalam nada. `app.bundle.js` é um intermediário gerado, incorporado ao HTML.

## Validação efetuada

- Abertura por arquivo local com rede desativada.
- Reprodução, pausa e reinício.
- Importação do arquivo `vegetallab-soja-v4-dia-120.json` fornecido pelo usuário.
- Reexportação com histórico diário idêntico ao arquivo original.
- Rejeição de esquema JSON incompatível sem perder a simulação atual.
- Layout de 390 px sem rolagem horizontal.

## Limitações científicas

Modelo didático e não calibrado. Fenologia baseada em calendário de 120 dias; germinação é uma sequência visual ilustrativa. ET₀ usa aproximações meteorológicas. Fluxos hídricos são representados em três camadas por cascata diária. Dados químicos são registrados, mas não geram efeitos automáticos de nutrição. A versão 4.1.0 mantém os cálculos da Soja V4.

Para avaliação por pesquisadores, registre a versão, navegador, arquivo JSON e dia observado. O JSON não contém geometria 3D; visualizadores alternativos precisam interpretar os indicadores.
