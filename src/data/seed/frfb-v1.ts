import type { ProgramFile } from '../program'

/**
 * FRFB V1, transcribed from "FRAME_FRFB_Ficha_Exemplo_V1.docx" (24/11/2026).
 *
 * Interpretation choices (see DECISION_LOG T-003):
 * - Rest ranges ("1:30–2:00") use the upper bound as the timer value; the
 *   timer is guidance and the range stays in the notes.
 * - The ficha gives RIR only in general terms (1–3; isolators may reach 0–1
 *   on selected sets): compounds target RIR 2, isolators RIR 1.
 * - Warm-up sets are not specified: 2 for heavy compounds, 1 for moderate
 *   compounds and for the first exercise of the day, 0 otherwise.
 * - "Either/or" exercises use one library variant; the other is a one-tap
 *   substitution. Optional shrugs (Frame B) are a day note, not an exercise.
 */
export const FRFB_V1: ProgramFile = {
  format: 'frame-program',
  version: 1,
  name: 'FRFB V1',
  source: 'FRAME_FRFB_Ficha_Exemplo_V1.docx',
  workouts: [
    {
      name: 'Frame A',
      weekday: 1,
      notes:
        'Ênfase: deltoide lateral, dorsais e bíceps. Se o tempo apertar, preservar primeiro os exercícios prioritários; não encurtar descanso de puxadas pesadas.',
      exercises: [
        { exerciseId: 'elevacao-lateral-maquina', workingSets: 3, warmupSets: 1, repMin: 10, repMax: 15, rirTarget: 1, restSec: 120, notes: 'Prioridade; controle, sem balanço. Máquina ou cabo. Descanso 1:30–2:00.' },
        { exerciseId: 'puxada-neutra', workingSets: 3, warmupSets: 2, repMin: 6, repMax: 8, rirTarget: 2, restSec: 180, notes: 'Foco em dorsais; amplitude confortável. Descanso 2:30–3:00.' },
        { exerciseId: 'remada-maquina', workingSets: 2, warmupSets: 1, repMin: 6, repMax: 10, rirTarget: 2, restSec: 150, notes: 'Evitar compensar com lombar. Descanso 2:00–2:30.' },
        { exerciseId: 'rosca-scott', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Bíceps; amplitude controlada. Descanso 1:30–2:00.' },
        { exerciseId: 'crucifixo-invertido-maquina', workingSets: 2, warmupSets: 0, repMin: 10, repMax: 15, rirTarget: 1, restSec: 90, notes: 'Deltoide posterior.' },
        { exerciseId: 'abdominal-polia', workingSets: 2, warmupSets: 0, repMin: 10, repMax: 15, rirTarget: 1, restSec: 90, notes: 'Progressão com carga quando controlado.' },
      ],
    },
    {
      name: 'Full Body A',
      weekday: 2,
      notes:
        'Ênfase: peito, quadríceps e estímulo geral. Rosca no cabo e tríceps na polia podem ser alternados como superset agonista-antagonista se isso não reduzir a qualidade das séries.',
      exercises: [
        { exerciseId: 'supino-inclinado-halteres', workingSets: 3, warmupSets: 2, repMin: 6, repMax: 8, rirTarget: 2, restSec: 180, notes: 'Peito; aquecimento específico antes. Máquina ou halteres. Descanso 2:30–3:00.' },
        { exerciseId: 'agachamento-hack', workingSets: 3, warmupSets: 2, repMin: 6, repMax: 10, rirTarget: 2, restSec: 180, notes: 'Quadríceps; amplitude segura. Descanso 2:30–3:00.' },
        { exerciseId: 'cadeira-flexora', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Ficha: "mesa flexora sentado". Posteriores; controle da excêntrica. Descanso 1:30–2:00.' },
        { exerciseId: 'remada-baixa', workingSets: 2, warmupSets: 1, repMin: 8, repMax: 10, rirTarget: 2, restSec: 150, notes: 'Costas; sem roubar. Polia ou máquina. Descanso 2:00–2:30.' },
        { exerciseId: 'rosca-polia', workingSets: 2, warmupSets: 0, repMin: 10, repMax: 12, rirTarget: 1, restSec: 90, notes: 'Séries diretas adicionais para bíceps.' },
        { exerciseId: 'triceps-barra-polia', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Cotovelos estáveis. Descanso 1:30–2:00.' },
      ],
    },
    {
      name: 'Frame B',
      weekday: 3,
      notes:
        'Ênfase: largura de dorsais, deltoide lateral/posterior e braços. Encolhimento é opcional e pode ser omitido; não é necessário volume extra para trapézio superior.',
      exercises: [
        { exerciseId: 'elevacao-lateral-polia', workingSets: 3, warmupSets: 1, repMin: 10, repMax: 15, rirTarget: 1, restSec: 120, notes: 'Variação diferente da segunda; ex.: cabo unilateral. Descanso 1:30–2:00.' },
        { exerciseId: 'puxada-unilateral', workingSets: 3, warmupSets: 1, repMin: 8, repMax: 12, rirTarget: 2, restSec: 150, notes: 'Buscar trajetória direcionada ao quadril. Descanso 2:00–2:30.' },
        { exerciseId: 'crucifixo-invertido-maquina', workingSets: 2, warmupSets: 0, repMin: 10, repMax: 15, rirTarget: 1, restSec: 90, notes: 'Reverse fly; deltoide posterior.' },
        { exerciseId: 'rosca-bayesian', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Bíceps em posição alongada. Descanso 1:30–2:00.' },
        { exerciseId: 'triceps-overhead-polia', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Ênfase na cabeça longa; sem forçar cotovelo. Descanso 1:30–2:00.' },
      ],
    },
    {
      name: 'Full Body B',
      weekday: 4,
      notes:
        'Ênfase: peito, cadeia posterior, pernas e complemento de braços. Panturrilhas podem ser pareadas com abdominal ou outro exercício não concorrente, se houver espaço e equipamentos.',
      exercises: [
        { exerciseId: 'supino-reto-barra', workingSets: 3, warmupSets: 2, repMin: 6, repMax: 8, rirTarget: 2, restSec: 180, notes: 'Peito; técnica estável. Máquina ou barra. Descanso 2:30–3:00.' },
        { exerciseId: 'terra-romeno', workingSets: 3, warmupSets: 2, repMin: 6, repMax: 8, rirTarget: 2, restSec: 180, notes: 'Posteriores/glúteos; não sacrificar posição. Descanso 2:30–3:00.' },
        { exerciseId: 'leg-press', workingSets: 2, warmupSets: 1, repMin: 8, repMax: 10, rirTarget: 2, restSec: 150, notes: 'Quadríceps; amplitude tolerável. Descanso 2:00–2:30.' },
        { exerciseId: 'puxada-aberta', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 10, rirTarget: 2, restSec: 150, notes: 'Puxada alta (variação); complemento de costas. Descanso 2:00–2:30.' },
        { exerciseId: 'triceps-corda', workingSets: 2, warmupSets: 0, repMin: 10, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Tríceps na polia (variação); volume direto adicional. Descanso 1:30–2:00.' },
        { exerciseId: 'panturrilha-em-pe', workingSets: 2, warmupSets: 0, repMin: 8, repMax: 12, rirTarget: 1, restSec: 120, notes: 'Pausa breve no alongamento. Sentado ou em pé. Descanso 1:30–2:00.' },
      ],
    },
  ],
}
