# Registro de decisões

Decisões técnicas (D-xxx) e de treino (T-xxx). Cada decisão de treino registra a configuração anterior e a proposta, os dados e as evidências, a aprovação e a avaliação.

## Técnicas

### D-001 · 24/11/2026 · PWA com React + TypeScript + Vite
Segue o stack pedido. Um PWA atende ao iPhone via Safari, sem App Store e sem custo. Alternativas descartadas: app nativo (exige conta de desenvolvedor paga) e Capacitor (complexidade sem ganho agora).

### D-002 · 24/11/2026 · IndexedDB com Dexie como fonte da verdade
- Cada ação do treino é gravada na hora, em transação. Não há estado só em memória.
- Dexie traz versões de schema com migração e consultas reativas, o que dispensa uma biblioteca de estado separada.
- Alternativa: `idb` (menor, mas exige escrever migrações e reatividade à mão).

### D-003 · 24/11/2026 · Cronômetro por timestamps
O iOS suspende o JavaScript de PWAs em segundo plano. Guardar `startedAt` e `pausedMs` garante tempo restante correto ao voltar e após recarregar. Limitação documentada: sem alerta com o app fechado (depende da Fase 9).

### D-004 · 24/11/2026 · Rotas com hash e caminhos relativos
Permite publicar em qualquer host estático gratuito, inclusive em subpasta, sem configurar reescrita de rotas.

### D-005 · 24/11/2026 · Atualização do app só com confirmação
O service worker novo espera o toque em "Atualizar". Assim uma atualização nunca recarrega o app no meio de uma série.

### D-006 · 24/11/2026 · Fonte de evidências: base verificada da evidence-coach
Skills avaliadas:
- **evidence-coach:** claims verificados com fonte, ano, nível e população. Adotada como fonte das regras.
- **getting-started-with-research-superpowers:** só uma introdução; as skills de busca não estão instaladas, e o ambiente bloqueia PubMed e Semantic Scholar. Não usada.

Consequência: nenhuma pesquisa nova nesta fase. As perguntas pendentes estão em `EVIDENCE_LIBRARY.md`. Para pesquisas novas: instalar as skills relacionadas (`--with-related`) e liberar `eutils.ncbi.nlm.nih.gov` e `api.semanticscholar.org`.

### D-007 · 24/11/2026 · Publicação no GitHub Pages
- Autorizada pelo usuário; repositório `gmitostro/FRAME` (público).
- Escolhido o GitHub Pages: gratuito, HTTPS e integrado ao repositório. Um workflow roda lint, testes e build antes de cada publicação.
- O app não envia dados a lugar nenhum: o repositório público expõe só o código, não o histórico.

### D-010 · 24/11/2026 · Formato de ficha (`frame-program`)
- A ficha é um JSON separado do backup: só treinos, sem histórico. Serve para importar, exportar e versionar programas.
- Exercícios personalizados viajam junto com a ficha.
- Importar substitui os treinos do programa ativo e nunca altera sessões já registradas, que guardam cópias próprias.

### D-008 · 24/11/2026 · Formulário de série no topo e cronômetro compacto
O teste em viewport de iPhone mostrou dois problemas:
- o cartão do cronômetro cobria o botão "Concluir série";
- o formulário ficava abaixo da dobra.

A solução:
- o formulário vem logo após o nome do exercício, com carga e repetições lado a lado;
- o cronômetro ocupa uma linha;
- a tela rola para manter o botão visível após cada série.

### D-009 · 24/11/2026 · Proteção contra toque duplo
O botão de concluir série fica bloqueado até a gravação terminar. Um toque duplo não registra duas séries.

### D-011 · 25/11/2026 · Alerta de descanso no nível do app
- O alerta, a tela ligada e o desbloqueio de áudio saíram da tela de treino para um componente montado uma vez (`RestWatcher`).
- O alerta é agendado para o horário exato do fim e reavaliado quando o app volta ao primeiro plano.
- O alerta não toca atrasado: o iOS suspende o JavaScript em segundo plano, e um bipe tardio confundiria. O tempo excedido aparece na tela.
- Alerta com a tela bloqueada exigiria Web Push com servidor, e mesmo assim sem precisão de segundos. Fica fora do escopo e documentado em `ARCHITECTURE.md`.

### D-012 · 25/11/2026 · Ordem da tela de exercício
Ordem de prioridade do usuário: nome, prescrição, sugestão, carga e reps, RIR, concluir.
- "Última vez" e sugestão viraram um bloco compacto.
- Os marcadores de série foram para o cabeçalho do formulário, e o botão diz qual série conclui ("Concluir série 2").
- A nota do exercício foi para baixo do botão, limitada a duas linhas.

Nada foi removido. Medição antes e depois em `TESTING.md`.

### D-013 · 25/11/2026 · Rolagem automática medida
- A rolagem só acontece depois de uma ação do usuário (registrar série, série extra).
- A distância é medida pelos elementos fixos reais (marcados com `data-overlay-*`), e a rolagem é a mínima, nunca empurrando o elemento para baixo da barra superior.
- A rolagem é sempre para baixo após registrar, e instantânea com "reduzir movimento".
- Trocar de exercício sempre abre no topo.

### D-014 · 25/11/2026 · "Reiniciar" volta ao descanso prescrito (substituída pela D-015)
"Reiniciar" significava começar o descanso de novo. Os +15/+30 s valiam para o descanso em andamento e não se acumulavam.

### D-015 · 26/11/2026 · "Reiniciar" remove só os acréscimos manuais
**Motivo:** no uso real no iPhone, "Reiniciar" devolvia o tempo já transcorrido (2:00 → 20 s → 1:40 → +30 s → Reiniciar → 2:00).

**Regra nova:** "Reiniciar" remove todos os +15/+30 s do descanso atual e preserva o tempo transcorrido e o estado de pausa. No mesmo exemplo, o resultado é 1:40.
- Sem acréscimos, nada muda.
- Se, sem os acréscimos, o descanso já tiver terminado, ele continua mostrando o tempo excedido sem tocar um alerta atrasado.

**Implementação:** a regra só restaura `durationMs` ao valor prescrito. Não há estado novo.

## Treino

### T-001 · 24/11/2026 · Esqueleto FRFB sem exercícios
- **Anterior:** nenhum programa.
- **Proposta:** quatro treinos nomeados, de segunda a quinta, vazios.
- **Motivo:** o pedido foi não inventar a ficha.
- **Aprovação:** implícita no pedido.
- **Avaliação:** quando a ficha for cadastrada.

### T-003 · 24/11/2026 · Transcrição da ficha FRFB V1
- **Anterior:** quatro treinos vazios.
- **Proposta:** a ficha "FRAME_FRFB_Ficha_Exemplo_V1" transcrita (`src/data/seed/frfb-v1.ts`), com séries, repetições, descanso e observações copiadas da ficha.
- **Interpretações necessárias**, todas editáveis no app:
  - **Descanso em faixa** ("1:30–2:00"): o cronômetro usa o limite superior. Isso coincide com os seus perfis (3:00, 2:30, 2:00, 1:30). A faixa fica nas notas.
  - **RIR:** a ficha diz "em geral 1–3; isoladores podem chegar a 0–1 em séries selecionadas". Ficou RIR 2 nos multiarticulares e RIR 1 nos isolados.
  - **Aquecimento** (não especificado):
    - 2 séries nos multiarticulares pesados;
    - 1 nos moderados e no primeiro exercício do dia;
    - 0 nos demais.
  - **Escolhas "A ou B"** (máquina ou cabo, máquina ou halteres, máquina ou barra, sentado ou em pé): ficou uma variante, e a outra está a um toque em Substituir.
    - Elevação lateral na máquina (Frame A) e na polia (Frame B).
    - Supino inclinado com halteres.
    - Supino reto com barra.
    - Panturrilha em pé.
    - Tríceps com barra na terça e com corda na quinta.
    - Puxada aberta como variação na quinta.
  - **"Mesa flexora sentado"** virou *cadeira flexora* (flexão de joelho sentado). A nota do exercício registra o nome da ficha.
  - **Encolhimento opcional** (Frame B, sem séries definidas) não virou exercício. Está na nota do dia, como a ficha indica.
- **Dados:** as séries diretas semanais por músculo batem com o resumo da ficha. Testado em `tests/program.test.ts`.
- **Evidência para revisão** (sem alteração feita):
  - bíceps, tríceps e deltoide lateral (prioridades) têm 6 séries diretas por semana. Isso está dentro da faixa inicial de 4–10 [STR-19], mas abaixo da meta padrão de ≥10 para hipertrofia [STR-02];
  - puxadas e supinos somam estímulo indireto para bíceps e tríceps;
  - a ficha prevê volume inicial moderado e adaptação gradual.
- **Aprovação:** ficha enviada pelo usuário como ponto de partida; as interpretações aguardam revisão.
- **Avaliação:** após 4–6 semanas, comparar a progressão das prioridades com a dos demais grupos.

### T-002 · 24/11/2026 · Regras de progressão e tolerância de RIR = 1
- **Proposta:** dupla progressão [STR-35] com incremento de 2,5% ou 5%, arredondado ao equipamento [STR-13]. Segurar a carga quando o RIR cai além da tolerância [STR-30]. Tolerância 1, pelo erro típico de ~1 repetição na estimativa de RIR [STR-32].
- **Compromisso:** tolerância 0 seria mais conservadora, mas tenderia a travar a progressão quando a última série sai com RIR 1 em vez de 2.
- **Aprovação:** pendente da sua revisão (configurável em Ajustes).
- **Avaliação:** após 6–8 semanas de uso, comparar sugestões aceitas e rejeitadas com a evolução de carga e repetições.
