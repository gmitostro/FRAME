# FRAME

Sistema pessoal de treino, hipertrofia e progressão. PWA instalável no iPhone, em português do Brasil, que funciona offline e guarda os dados no próprio aparelho.

## O que já funciona

- Programa **FRFB V1** já carregado, transcrito da sua ficha: Frame A, Full Body A, Frame B e Full Body B, de segunda a quinta. Tudo é editável, e fichas podem ser importadas e exportadas em JSON (Ajustes → Programa).
- Editor de treino: exercícios, séries efetivas, aquecimento, faixa de repetições, RIR alvo, descanso, notas, ordem e estimativa de duração.
- Treino ao vivo: carga e repetições pré-preenchidas, RIR, aquecimentos separados, pular, substituir, pausar, retomar após fechar o app e finalizar.
- Cronômetro de descanso automático por exercício, com pausar, reiniciar, +15 s, +30 s e encerrar. Ele sobrevive a recarregar a página.
- Sugestão de carga por dupla progressão, com o motivo explicado.
- Biblioteca com 84 exercícios, busca e filtros, exercícios personalizados, histórico e recordes registrados.
- Histórico de treinos, backup e restauração em JSON e ajustes.

Detalhes em `PROJECT_STATUS.md`.

## Rodar localmente

```bash
npm install
```

```bash
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção em `dist/` |
| `npm test` | Testes unitários (Vitest) |
| `npm run lint` | Lint (oxlint) |
| `npm run e2e` | Teste ponta a ponta em viewport de iPhone (precisa de `npm run build` antes). `SHOTS=1` salva capturas em `e2e/shots/` |
| `npm run icons` | Regera os ícones PNG do PWA |

## Instalar no iPhone

Endereço: **https://gmitostro.github.io/FRAME/**

1. No iPhone, abra o endereço no **Safari** (não funciona pelo app Arquivos nem por outros navegadores para instalar).
3. Toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.
4. Abra o FRAME pelo ícone. A partir daí ele funciona sem internet.

Instalado na tela de início, o iOS mantém os dados do app. No Safari comum, o sistema pode apagar dados de sites sem uso. Mesmo instalado, **exporte backups** em Ajustes → Dados.

## Publicação

GitHub Pages, pelo workflow `.github/workflows/deploy.yml`. Cada push em `main` roda lint, testes e build, e publica `dist/`. Para ativar uma vez: no GitHub, abra **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**. O build usa caminhos relativos e rotas com `#`, então funciona na subpasta `/FRAME/`.

O repositório é público: o **código** fica visível, mas **seus treinos não**, porque ficam só no seu aparelho.

## Privacidade

Nenhum dado sai do aparelho. Não há servidor, conta, analytics nem chamadas de IA. Backups são arquivos que você mesmo salva.
