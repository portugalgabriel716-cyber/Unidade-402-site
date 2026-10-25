# Unidade 402 — Visualizador 3D

Site estático em HTML, CSS e JavaScript usando Three.js 0.180.0, com dependências locais. O arquivo GLB foi exportado diretamente do apartamento feito no Blender.

## Executar localmente

```sh
python3 -m http.server 4173 --directory dist
```

Abra http://localhost:4173. Não abra `index.html` diretamente pelo sistema de arquivos: o carregamento do modelo usa HTTP.

## Recursos

- Órbita, zoom e deslocamento com mouse ou toque.
- Vistas de perspectiva e planta superior.
- Paredes em corte de 1,20 m e completas de 2,70 m.
- Foco nas três suítes, estar/jantar e cozinha/serviço.
- Controle do mobiliário e dos nomes dos ambientes.
- Download do GLB e da planta original, captura PNG e tela cheia.
- Layout adaptado para computador e celular.

O pé-direito de 2,70 m, os acabamentos e os móveis da área social são premissas do modelo. Camas e roupeiros seguem a legenda da planta. As áreas exibidas são as nominais do PDF.

O GLB preserva o modelo completo. Os campos `webUpper`, `webCategory` e `webLabel` nos extras dos objetos controlam as camadas no navegador. A textura procedural da madeira foi substituída por sua cor base para a exportação GLB.

Three.js é distribuído sob a licença MIT, incluída em `dist/vendor/LICENSE`.
