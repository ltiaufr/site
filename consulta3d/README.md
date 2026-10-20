# Consulta Equino 3D — publicação estática

Esta pasta contém apenas a interface pública de consulta. O associador Python e os arquivos experimentais permanecem locais.

## Arquivos necessários para ativar

- `index.html` — interface de consulta (já incluída)
- `associacoes.json` — cópia do JSON final `associacoes_equino_v42.json`, com a propriedade `records` e poses `azimuth`, `elevation`, `distance`, `target` e `image`
- `modelo/model_colorido.dae` — modelo Collada e eventuais recursos referenciados
- `images/` — imagens térmicas selecionadas, com os nomes originais registrados em `records[].image`

Os caminhos das imagens são normalizados para `./images/<nome do arquivo>`, e o modelo é carregado por `./modelo/model_colorido.dae`, compatíveis com GitHub Pages em `/site/consulta3d/`.

**Importante:** o site ainda não está pronto para uso: não publique/mescle esta proposta antes de adicionar os dados e testar o carregamento do modelo e a navegação bidirecional. Os arquivos públicos serão acessíveis a qualquer visitante.

Para testar localmente após adicionar os dados, execute na raiz do repositório:

```bat
py -m http.server 8000
```

Abra `http://127.0.0.1:8000/consulta3d/`.
