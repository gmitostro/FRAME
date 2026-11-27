# Sistema de treino

As regras abaixo estão implementadas em `src/domain/`. IDs entre colchetes apontam para `EVIDENCE_LIBRARY.md`. Valores marcados como **ajuste** vêm de preferência sua ou de decisão de engenharia, não de evidência.

## Estrutura

- Divisão FRFB, quatro dias: segunda Frame A, terça Full Body A, quarta Frame B, quinta Full Body B. Sexta a domingo, descanso. **Ajuste.**
- Os treinos começam **vazios**. Exercícios, volume, faixas de repetição e RIR serão definidos por você e cadastrados no app; nada foi inventado.
- Frequência e volume de referência para revisar a ficha quando ela chegar: pelo menos 2 sessões por semana para cada grupo muscular [STR-01]; pelo menos 10 séries semanais por músculo para hipertrofia [STR-02], com retornos decrescentes acima de ~18–20 [STR-04] e incerteza acima de ~25 [STR-19]. Prioridades atuais: bíceps e tríceps (principais), deltoide lateral e dorsais (secundárias). Editáveis em Ajustes.

## Valores iniciais de um exercício adicionado

Ao adicionar um exercício a um treino, o app sugere valores iniciais editáveis: 2 séries efetivas (seu hábito), 6–10 repetições e RIR 2 [STR-05]. O aquecimento depende do perfil: 2 séries para multiarticular pesado, 1 para moderado e 0 para isolado. **Ajuste.**

## Como registrar a carga (v0.3)

A tela de registro diz o que o número de carga significa em cada exercício:
- **Carga:** carga total (barra + anilhas, pilha da máquina ou da polia).
- **Carga por halter:** o peso de um halter.
- **Carga por lado:** as anilhas de um lado.
- **Carga adicional:** peso corporal; registre só o que foi acrescentado (0 = só o corpo).
- **Assistência:** a assistência da máquina.

Em exercícios **sem carga mensurável** (ex.: roda abdominal), o campo de carga não aparece.

"Reps por lado" aparece em exercícios **unilaterais**. Tudo é editável em Exercícios → (exercício) → editar.

## Esforço (RIR)

- RIR = repetições que ainda sobravam. Escala: RPE 8 = RIR 2 [STR-29].
- Padrão de 2–3 RIR; ir à falha não é necessário [STR-05]. Quão perto da falha é melhor para hipertrofia é **contestado** [STR-28].
- O RIR registrado costuma errar por cerca de 1 repetição [STR-32]. Por isso a tolerância de RIR padrão é 1 (configurável de 0 a 2).
- **Origem do RIR (v0.3):** o RIR vem pré-preenchido para não exigir toque extra, mas aparece contornado com "Sugerido: toque para confirmar". O app grava se você confirmou (toque) ou manteve o pré-preenchido. Séries anteriores à v0.3 ficam com origem desconhecida. O futuro motor de progressão só deve usar RIR confirmado.

## Dupla progressão (`progression.ts`)

Com base nas séries efetivas da **última sessão** deste exercício [STR-35]:

| Situação | Sugestão |
|---|---|
| Sem histórico | Nenhuma |
| Alguma série marcada com "técnica comprometida" | Manter a carga |
| Menos séries que o prescrito | Manter a carga |
| Alguma série abaixo do mínimo da faixa | Manter; se repetir, considerar reduzir [STR-30] |
| Faixa ainda não completada | Manter a carga e buscar +1 repetição |
| Todas no topo da faixa, mas com RIR abaixo de (alvo − tolerância) | Manter a carga [STR-30, STR-32] |
| Todas no topo da faixa, com RIR dentro do alvo | **Aumentar** e voltar ao mínimo da faixa |

Tamanho do aumento [STR-13]:
- 2,5% da carga atual em membros superiores e isolados;
- 5% em multiarticulares de membros inferiores;
- arredondado para cima, para o menor incremento do equipamento (por exercício).

Se o incremento passar de 10% (por exemplo, halteres leves), o app avisa e sugere completar mais repetições antes.

**Exercícios assistidos** (o número registrado é a assistência): progredir é **reduzir** a assistência. **Ajuste**, não evidência:
- a referência é a série com **mais** assistência (a mais fácil), e não a de menos;
- a redução é de um incremento do equipamento, sem percentual (o percentual da assistência não diz quanto muda a carga movida, porque o peso corporal não é conhecido) e nunca abaixo de 0;
- com 0 de assistência no topo da faixa, o app mantém e sugere passar para a versão com peso corporal;
- as regras de manter (técnica, séries, faixa, RIR) são as mesmas.

A sugestão nunca altera o treino. Ela pré-preenche a carga, que você pode mudar.

## Descanso

Perfis padrão:

| Perfil | Descanso |
|---|---|
| Multiarticular pesado | 3:00 |
| Multiarticular moderado | 2:30 |
| Isolado | 2:00 |
| Isolado leve | 1:30 |

O mínimo é 1:30. Os perfis são **ajuste** seu, coerentes com a evidência:
- hipertrofia: descanso acima de 60 s tem pequeno benefício, e não houve diferença acima de 90 s [STR-33];
- força em treinados: mais de 2 min nos exercícios principais [STR-34] (contestado).

Outras regras do cronômetro:
- Começa sozinho após cada série efetiva. Aquecimentos não o iniciam, a menos que você ative isso em Ajustes.
- É uma orientação: ao fim ele passa a contar o tempo excedido e não obriga a começar a próxima série.
- Registra o descanso real (tempo entre séries efetivas do mesmo exercício).

## Aquecimento

- Séries de aquecimento são registradas à parte e **não contam** como volume, progressão ou tonelagem.
- Aquecimento específico basta quando falta tempo [STR-54]. O aquecimento geral é uma nota livre no treino.

## Estimativa de duração (`duration.ts`)

Para cada exercício a estimativa soma:
- séries efetivas × (tempo da série + tempo de registro);
- descansos entre séries efetivas;
- aquecimentos × (série + registro + descanso de aquecimento);
- uma troca de exercício.

Ao total soma-se o aquecimento geral. Valores padrão (**ajuste**, calibráveis em Ajustes → Avançado):

| Item | Padrão |
|---|---|
| Série multiarticular | 45 s |
| Série isolada | 35 s |
| Registro | 15 s |
| Troca de exercício | 90 s |
| Descanso de aquecimento | 60 s |
| Aquecimento geral | 5 min |

A meta é 60 min, com ±5 min contando como "dentro". Acima da meta, o app sugere revisar redundâncias e séries antes de encurtar descansos de exercícios pesados. Sem tempo, encurtar o descanso de acessórios ou usar bi-sets é preferível [STR-24, STR-34].

## Deload (referência para a Fase 8)

Reduzir séries ou esforço, sem parar de treinar [STR-37, STR-39]. A frequência típica em atletas é ~6 dias a cada 5–6 semanas [STR-38]. Para recreacionais, o deload deve ser feito quando os dados indicarem, não por calendário. A evidência de benefício é fraca.

## Volume (Fase 6, `volume.ts`)

Tela "Volume por músculo", aberta pelo Início.
- **Séries diretas:** séries efetivas de exercícios em que o músculo é o principal.
- **Séries indiretas:** séries efetivas de exercícios em que o músculo aparece como secundário na biblioteca. Mostradas inteiras, nunca somadas às diretas e fora da comparação. A contagem fracionada continua como pesquisa pendente (EVIDENCE_LIBRARY, item 2).
- Aquecimentos não contam. Séries com técnica comprometida contam, porque foram feitas (só ficam fora da progressão).
- **Feito:** treinos concluídos com início na semana (segunda a domingo). **Ficha:** cada treino do programa ativo uma vez por semana.
- **Comparação:** séries diretas da ficha contra ≥10 por semana [STR-02], com retornos decrescentes acima de ~20 [STR-04]. Faixa de partida, não meta individual.
- **Prioridades** (Ajustes) aparecem primeiro, mesmo com zero séries; um aviso lista as que têm menos de 10 diretas na ficha.

## Recuperação (Fase 8)

Ainda não implementada. O plano:
- check-in curto, com cada item comparado ao seu normal (pior / normal / melhor) [MON-19, MON-20];
- analisar tendências, nunca um valor isolado;
- referência de sono: 7 h ou mais [MON-31].
