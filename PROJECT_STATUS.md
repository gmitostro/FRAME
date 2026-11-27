# Status do projeto

Atualizado em 26/11/2026 · versão 0.3.0-alpha.1

## Fases

| Fase | Situação |
|---|---|
| 0 · Ambiente e pesquisa | Concluída |
| 1 · Fundação (arquitetura, design system, localização, navegação, modelos, persistência, PWA) | Concluída |
| 2 · Dashboard | Concluída (indicadores básicos) |
| 3 · Motor de treino | Concluída |
| 4 · Cronômetro | Concluída (som e vibração não verificados no iPhone) |
| 5 · Exercícios e histórico | Parcial: biblioteca, busca, filtros, personalizados, histórico e recordes prontos; instruções de execução e erros comuns ainda vazios |
| 6 · Progressão e análises | Parcial: dupla progressão e sugestão de carga prontas; volume semanal por músculo pronto; gráficos e consistência pendentes |
| 7 · Métodos avançados | Não iniciada |
| 8 · Recuperação e coach adaptativo | Não iniciada |
| 9 · Notificações | Não iniciada |
| 10 · Evidence Lab (interface) | Não iniciada; índice de evidências em `EVIDENCE_LIBRARY.md` |
| 11 · Validação final | Não iniciada |

**Fase atual:** v0.3 Data Foundation. A etapa 1 (origem do RIR, classificação de carga, cópia no treino) está concluída; a etapa 2 (camada de exposições do histórico) ainda não começou.

## Funcionalidades concluídas

- Ficha **FRFB V1** transcrita do seu documento e carregada na primeira abertura (6/6/5/6 exercícios; estimativas de ~52, ~57, ~41 e ~58 min). As escolhas de interpretação estão em `DECISION_LOG.md` (T-003).
- Importar e exportar fichas em JSON (formato `frame-program`) e recarregar a FRFB V1, em Ajustes → Programa. O histórico nunca é afetado.
- Treinos editáveis sem código; também dá para criar e excluir treinos.
- Editor de treino:
  - séries efetivas, aquecimento, repetições mín./máx., RIR alvo e descanso (padrão do perfil ou personalizado);
  - notas e reordenação;
  - estimativa de duração por exercício e total, comparada com a meta.
- Treino ao vivo:
  - pré-preenchimento: repete a série anterior desta sessão; senão usa a sugestão; senão a última sessão;
  - aquecimentos separados, que não contam como volume nem disparam o cronômetro, salvo ajuste;
  - editar e excluir série, marcar técnica comprometida;
  - pular e retomar exercício; substituir, no lugar ou após séries já feitas;
  - adicionar exercício, notas, pausar e retomar o treino;
  - finalizar ou descartar, com resumo final.
- Persistência a cada ação. Recarregar ou fechar o app no meio do treino não perde nada; um aviso aparece se o treino ficou aberto por mais de 12 h.
- Cronômetro baseado em timestamps:
  - pausar, reiniciar, +15 s, +30 s e encerrar;
  - conta o tempo excedido;
  - registra o descanso real;
  - som ao fim, vibração onde houver suporte e tela ligada onde houver suporte.
- Dupla progressão com explicação; nunca altera o treino sozinha.
- Biblioteca com 84 exercícios (nomes em pt-BR), busca sem acento, filtros por músculo, equipamento e prioridade, e exercícios personalizados.
- Histórico com detalhes, descanso médio e exclusão; recordes registrados (sem estimativas de 1RM).
- Ajustes:
  - dias de treino, duração alvo, prioridades de físico;
  - perfis de descanso, descanso mínimo, som, vibração, tela ligada;
  - tolerância de RIR e modelo de duração;
  - backup, restauração e estado do armazenamento.
- PWA: manifest, ícones, service worker com cache offline e aviso de nova versão.
- Publicado em https://gmitostro.github.io/FRAME/ pelo GitHub Pages; cada push em `main` roda lint, testes e build antes de publicar.

## Pendente

- Instruções de execução, erros comuns e amplitude por exercício (o modelo já tem os campos; o conteúdo precisa de fonte).
- Gráficos de progressão, consistência e duração real versus estimada.
- Calibrar o modelo de duração com as sessões reais.
- Métodos avançados, check-in de recuperação, coach adaptativo, notificações, interface do Evidence Lab e registro de decisões no app.
- Testes no iPhone real (instalação, cronômetro, som, tela ligada).

## Problemas conhecidos

- **Nada foi testado em um iPhone real.** Os testes ponta a ponta usam Chromium emulando o iPhone 13. Safari/WebKit não está disponível neste ambiente.
- No iPhone, o JavaScript para quando o app vai para segundo plano. O tempo restante é recalculado corretamente ao voltar, mas **não há alerta sonoro com o app fechado ou a tela bloqueada**. Detalhes e alternativas em `ARCHITECTURE.md` ("iOS / PWA platform limits").
- No iPhone, o som do fim do descanso fica mudo com a chave de silêncio ligada, e o Safari não tem a API de vibração.
- No iPhone SE, ao aparecer o cronômetro a tela rola ~94 px e o nome do exercício sai da vista; a barra superior mostra o nome do treino, não o do exercício.
- O bundle JS tem 166 KB gzip, carregado uma vez e mantido em cache offline.

## Testes realizados

Ver `TESTING.md`. Resumo desta versão:
- typecheck, lint e build sem erros;
- 71 testes unitários passando;
- quatro testes ponta a ponta passando: fluxo completo (20 verificações), cronômetro (11), layout em 4 tamanhos de iPhone (6) e dados da v0.3 (7).

## Próximos passos

1. Testar no seu iPhone: instalação, cronômetro, som, tela ligada e persistência após dias sem uso.
2. Revisar com você as interpretações da ficha (T-003) e o volume das prioridades (bíceps e tríceps com 6 séries diretas por semana).
3. Fase 6: gráficos (volume por músculo pronto, aguardando validação).
