import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  MovementPattern,
  MuscleGroup,
  RestProfileId,
} from '../../domain/types'

/**
 * Built-in exercise library (pt-BR names as used in Brazilian gyms).
 * Classification only: muscles, equipment, movement pattern, category, rest
 * profile and the smallest practical load step. No execution videos or
 * claims about technique are included; the user can add notes.
 *
 * Bump EXERCISE_SEED_VERSION when adding rows: new ids are inserted on
 * startup and existing rows (possibly edited by the user) are left alone.
 */
export const EXERCISE_SEED_VERSION = 1

type Row = [
  id: string,
  namePt: string,
  nameEn: string,
  primary: MuscleGroup,
  secondary: MuscleGroup[],
  equipment: Equipment,
  pattern: MovementPattern,
  category: ExerciseCategory,
  rest: RestProfileId,
  stepKg: number,
  lowerBody?: boolean,
]

const ROWS: Row[] = [
  // Peitoral
  ['supino-reto-barra', 'Supino reto com barra', 'Barbell bench press', 'chest', ['triceps', 'frontDelts'], 'barbell', 'horizontalPush', 'compound', 'heavyCompound', 2.5],
  ['supino-inclinado-barra', 'Supino inclinado com barra', 'Incline barbell bench press', 'chest', ['frontDelts', 'triceps'], 'barbell', 'horizontalPush', 'compound', 'heavyCompound', 2.5],
  ['supino-reto-halteres', 'Supino reto com halteres', 'Dumbbell bench press', 'chest', ['triceps', 'frontDelts'], 'dumbbell', 'horizontalPush', 'compound', 'moderateCompound', 2],
  ['supino-inclinado-halteres', 'Supino inclinado com halteres', 'Incline dumbbell press', 'chest', ['frontDelts', 'triceps'], 'dumbbell', 'horizontalPush', 'compound', 'moderateCompound', 2],
  ['supino-maquina', 'Supino na máquina', 'Machine chest press', 'chest', ['triceps', 'frontDelts'], 'machine', 'horizontalPush', 'compound', 'moderateCompound', 2.5],
  ['supino-inclinado-smith', 'Supino inclinado no Smith', 'Smith incline press', 'chest', ['frontDelts', 'triceps'], 'smith', 'horizontalPush', 'compound', 'moderateCompound', 2.5],
  ['crucifixo-halteres', 'Crucifixo com halteres', 'Dumbbell fly', 'chest', ['frontDelts'], 'dumbbell', 'fly', 'isolation', 'isolation', 2],
  ['voador', 'Voador (peck deck)', 'Pec deck', 'chest', ['frontDelts'], 'machine', 'fly', 'isolation', 'isolation', 2.5],
  ['crossover', 'Crossover na polia', 'Cable crossover', 'chest', ['frontDelts'], 'cable', 'fly', 'isolation', 'isolation', 2.5],
  ['paralelas', 'Mergulho nas paralelas', 'Dips', 'chest', ['triceps', 'frontDelts'], 'bodyweight', 'verticalPush', 'compound', 'moderateCompound', 2.5],
  ['flexao', 'Flexão de braços', 'Push-up', 'chest', ['triceps', 'frontDelts'], 'bodyweight', 'horizontalPush', 'compound', 'isolation', 2.5],

  // Costas
  ['barra-fixa', 'Barra fixa pronada', 'Pull-up', 'lats', ['biceps', 'upperBack'], 'bodyweight', 'verticalPull', 'compound', 'moderateCompound', 2.5],
  ['barra-fixa-supinada', 'Barra fixa supinada', 'Chin-up', 'lats', ['biceps', 'upperBack'], 'bodyweight', 'verticalPull', 'compound', 'moderateCompound', 2.5],
  ['puxada-aberta', 'Puxada frontal aberta', 'Wide-grip lat pulldown', 'lats', ['biceps', 'upperBack'], 'cable', 'verticalPull', 'compound', 'moderateCompound', 2.5],
  ['puxada-neutra', 'Puxada com pegada neutra', 'Neutral-grip lat pulldown', 'lats', ['biceps', 'upperBack'], 'cable', 'verticalPull', 'compound', 'moderateCompound', 2.5],
  ['puxada-supinada', 'Puxada supinada', 'Underhand lat pulldown', 'lats', ['biceps', 'upperBack'], 'cable', 'verticalPull', 'compound', 'moderateCompound', 2.5],
  ['puxada-unilateral', 'Puxada unilateral na polia', 'Single-arm lat pulldown', 'lats', ['biceps'], 'cable', 'verticalPull', 'compound', 'isolation', 2.5],
  ['pulldown-bracos-estendidos', 'Pulldown com braços estendidos', 'Straight-arm pulldown', 'lats', ['triceps'], 'cable', 'shoulderExtension', 'isolation', 'isolation', 2.5],
  ['puxada-maquina', 'Puxada na máquina articulada', 'Machine pulldown', 'lats', ['biceps', 'upperBack'], 'machine', 'verticalPull', 'compound', 'moderateCompound', 2.5],
  ['remada-curvada', 'Remada curvada com barra', 'Barbell row', 'upperBack', ['lats', 'rearDelts', 'biceps'], 'barbell', 'horizontalPull', 'compound', 'heavyCompound', 2.5],
  ['remada-baixa', 'Remada baixa na polia', 'Seated cable row', 'upperBack', ['lats', 'rearDelts', 'biceps'], 'cable', 'horizontalPull', 'compound', 'moderateCompound', 2.5],
  ['remada-unilateral', 'Remada unilateral com halter', 'One-arm dumbbell row', 'lats', ['upperBack', 'biceps'], 'dumbbell', 'horizontalPull', 'compound', 'moderateCompound', 2],
  ['remada-maquina', 'Remada na máquina com apoio no peito', 'Chest-supported machine row', 'upperBack', ['lats', 'rearDelts', 'biceps'], 'machine', 'horizontalPull', 'compound', 'moderateCompound', 2.5],
  ['remada-cavalinho', 'Remada cavalinho', 'T-bar row', 'upperBack', ['lats', 'biceps'], 'barbell', 'horizontalPull', 'compound', 'heavyCompound', 2.5],
  ['remada-serrote', 'Remada serrote', 'Kroc row', 'lats', ['upperBack', 'biceps'], 'dumbbell', 'horizontalPull', 'compound', 'moderateCompound', 2],

  // Ombros
  ['desenvolvimento-halteres', 'Desenvolvimento com halteres', 'Dumbbell shoulder press', 'frontDelts', ['triceps', 'lateralDelts'], 'dumbbell', 'verticalPush', 'compound', 'moderateCompound', 2],
  ['desenvolvimento-barra', 'Desenvolvimento militar com barra', 'Overhead press', 'frontDelts', ['triceps', 'lateralDelts'], 'barbell', 'verticalPush', 'compound', 'heavyCompound', 2.5],
  ['desenvolvimento-maquina', 'Desenvolvimento na máquina', 'Machine shoulder press', 'frontDelts', ['triceps', 'lateralDelts'], 'machine', 'verticalPush', 'compound', 'moderateCompound', 2.5],
  ['elevacao-lateral-halteres', 'Elevação lateral com halteres', 'Dumbbell lateral raise', 'lateralDelts', [], 'dumbbell', 'shoulderAbduction', 'isolation', 'lightIsolation', 2],
  ['elevacao-lateral-polia', 'Elevação lateral na polia', 'Cable lateral raise', 'lateralDelts', [], 'cable', 'shoulderAbduction', 'isolation', 'lightIsolation', 2.5],
  ['elevacao-lateral-maquina', 'Elevação lateral na máquina', 'Machine lateral raise', 'lateralDelts', [], 'machine', 'shoulderAbduction', 'isolation', 'lightIsolation', 2.5],
  ['elevacao-lateral-inclinado', 'Elevação lateral deitado no banco inclinado', 'Lean-in / incline lateral raise', 'lateralDelts', [], 'dumbbell', 'shoulderAbduction', 'isolation', 'lightIsolation', 2],
  ['crucifixo-invertido-maquina', 'Crucifixo invertido na máquina', 'Reverse pec deck', 'rearDelts', ['upperBack'], 'machine', 'rearDeltFly', 'isolation', 'lightIsolation', 2.5],
  ['crucifixo-invertido-halteres', 'Crucifixo invertido com halteres', 'Dumbbell reverse fly', 'rearDelts', ['upperBack'], 'dumbbell', 'rearDeltFly', 'isolation', 'lightIsolation', 2],
  ['face-pull', 'Face pull na polia', 'Face pull', 'rearDelts', ['upperBack'], 'cable', 'rearDeltFly', 'isolation', 'lightIsolation', 2.5],
  ['elevacao-frontal', 'Elevação frontal', 'Front raise', 'frontDelts', [], 'dumbbell', 'shoulderAbduction', 'isolation', 'lightIsolation', 2],
  ['encolhimento-halteres', 'Encolhimento com halteres', 'Dumbbell shrug', 'traps', [], 'dumbbell', 'shrug', 'isolation', 'isolation', 2],

  // Bíceps
  ['rosca-direta-barra', 'Rosca direta com barra', 'Barbell curl', 'biceps', ['forearms'], 'barbell', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-direta-w', 'Rosca direta com barra W', 'EZ-bar curl', 'biceps', ['forearms'], 'ezBar', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-alternada', 'Rosca alternada com halteres', 'Alternating dumbbell curl', 'biceps', ['forearms'], 'dumbbell', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-martelo', 'Rosca martelo', 'Hammer curl', 'biceps', ['forearms'], 'dumbbell', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-scott', 'Rosca Scott', 'Preacher curl', 'biceps', ['forearms'], 'ezBar', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-scott-maquina', 'Rosca Scott na máquina', 'Machine preacher curl', 'biceps', [], 'machine', 'elbowFlexion', 'isolation', 'isolation', 2.5],
  ['rosca-inclinada', 'Rosca inclinada com halteres', 'Incline dumbbell curl', 'biceps', ['forearms'], 'dumbbell', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-polia', 'Rosca na polia', 'Cable curl', 'biceps', ['forearms'], 'cable', 'elbowFlexion', 'isolation', 'isolation', 2.5],
  ['rosca-bayesian', 'Rosca Bayesian na polia', 'Bayesian cable curl', 'biceps', [], 'cable', 'elbowFlexion', 'isolation', 'isolation', 2.5],
  ['rosca-concentrada', 'Rosca concentrada', 'Concentration curl', 'biceps', [], 'dumbbell', 'elbowFlexion', 'isolation', 'isolation', 2],
  ['rosca-inversa', 'Rosca inversa', 'Reverse curl', 'forearms', ['biceps'], 'ezBar', 'elbowFlexion', 'isolation', 'isolation', 2],

  // Tríceps
  ['triceps-corda', 'Tríceps na polia com corda', 'Rope pushdown', 'triceps', [], 'cable', 'elbowExtension', 'isolation', 'isolation', 2.5],
  ['triceps-barra-polia', 'Tríceps na polia com barra', 'Bar pushdown', 'triceps', [], 'cable', 'elbowExtension', 'isolation', 'isolation', 2.5],
  ['triceps-unilateral-polia', 'Tríceps unilateral na polia', 'Single-arm cable pushdown', 'triceps', [], 'cable', 'elbowExtension', 'isolation', 'isolation', 2.5],
  ['triceps-overhead-polia', 'Tríceps overhead na polia', 'Overhead cable extension', 'triceps', [], 'cable', 'elbowExtension', 'isolation', 'isolation', 2.5],
  ['triceps-testa', 'Tríceps testa com barra W', 'EZ-bar skull crusher', 'triceps', [], 'ezBar', 'elbowExtension', 'isolation', 'isolation', 2],
  ['triceps-frances', 'Tríceps francês com halter', 'Overhead dumbbell extension', 'triceps', [], 'dumbbell', 'elbowExtension', 'isolation', 'isolation', 2],
  ['triceps-maquina', 'Tríceps na máquina', 'Machine triceps extension', 'triceps', [], 'machine', 'elbowExtension', 'isolation', 'isolation', 2.5],
  ['supino-fechado', 'Supino fechado', 'Close-grip bench press', 'triceps', ['chest', 'frontDelts'], 'barbell', 'horizontalPush', 'compound', 'moderateCompound', 2.5],
  ['triceps-coice', 'Tríceps coice', 'Dumbbell kickback', 'triceps', [], 'dumbbell', 'elbowExtension', 'isolation', 'lightIsolation', 2],
  ['mergulho-banco', 'Mergulho no banco', 'Bench dip', 'triceps', ['chest', 'frontDelts'], 'bodyweight', 'elbowExtension', 'compound', 'isolation', 2.5],

  // Pernas
  ['agachamento-livre', 'Agachamento livre com barra', 'Back squat', 'quads', ['glutes', 'adductors'], 'barbell', 'squat', 'compound', 'heavyCompound', 2.5, true],
  ['agachamento-smith', 'Agachamento no Smith', 'Smith machine squat', 'quads', ['glutes', 'adductors'], 'smith', 'squat', 'compound', 'heavyCompound', 2.5, true],
  ['agachamento-hack', 'Agachamento hack', 'Hack squat', 'quads', ['glutes'], 'machine', 'squat', 'compound', 'heavyCompound', 2.5, true],
  ['leg-press', 'Leg press 45°', '45° leg press', 'quads', ['glutes', 'adductors'], 'machine', 'squat', 'compound', 'heavyCompound', 5, true],
  ['pendulo', 'Agachamento no pêndulo', 'Pendulum squat', 'quads', ['glutes'], 'machine', 'squat', 'compound', 'heavyCompound', 2.5, true],
  ['agachamento-bulgaro', 'Agachamento búlgaro', 'Bulgarian split squat', 'quads', ['glutes', 'adductors'], 'dumbbell', 'lunge', 'compound', 'moderateCompound', 2, true],
  ['afundo', 'Afundo com halteres', 'Dumbbell lunge', 'quads', ['glutes', 'adductors'], 'dumbbell', 'lunge', 'compound', 'moderateCompound', 2, true],
  ['cadeira-extensora', 'Cadeira extensora', 'Leg extension', 'quads', [], 'machine', 'kneeExtension', 'isolation', 'isolation', 2.5, true],
  ['levantamento-terra', 'Levantamento terra', 'Deadlift', 'glutes', ['hamstrings', 'lowerBack', 'upperBack'], 'barbell', 'hinge', 'compound', 'heavyCompound', 2.5, true],
  ['terra-romeno', 'Levantamento terra romeno', 'Romanian deadlift', 'hamstrings', ['glutes', 'lowerBack'], 'barbell', 'hinge', 'compound', 'heavyCompound', 2.5, true],
  ['stiff-halteres', 'Stiff com halteres', 'Dumbbell stiff-leg deadlift', 'hamstrings', ['glutes', 'lowerBack'], 'dumbbell', 'hinge', 'compound', 'moderateCompound', 2, true],
  ['mesa-flexora', 'Mesa flexora', 'Lying leg curl', 'hamstrings', [], 'machine', 'kneeFlexion', 'isolation', 'isolation', 2.5, true],
  ['cadeira-flexora', 'Cadeira flexora', 'Seated leg curl', 'hamstrings', [], 'machine', 'kneeFlexion', 'isolation', 'isolation', 2.5, true],
  ['elevacao-pelvica', 'Elevação pélvica com barra', 'Barbell hip thrust', 'glutes', ['hamstrings'], 'barbell', 'hipExtension', 'compound', 'moderateCompound', 2.5, true],
  ['elevacao-pelvica-maquina', 'Elevação pélvica na máquina', 'Machine hip thrust', 'glutes', ['hamstrings'], 'machine', 'hipExtension', 'compound', 'moderateCompound', 2.5, true],
  ['cadeira-abdutora', 'Cadeira abdutora', 'Hip abduction machine', 'glutes', [], 'machine', 'hipAbduction', 'isolation', 'lightIsolation', 2.5, true],
  ['cadeira-adutora', 'Cadeira adutora', 'Hip adduction machine', 'adductors', [], 'machine', 'hipAdduction', 'isolation', 'lightIsolation', 2.5, true],
  ['panturrilha-em-pe', 'Panturrilha em pé', 'Standing calf raise', 'calves', [], 'machine', 'calfRaise', 'isolation', 'lightIsolation', 2.5, true],
  ['panturrilha-sentado', 'Panturrilha sentado', 'Seated calf raise', 'calves', [], 'machine', 'calfRaise', 'isolation', 'lightIsolation', 2.5, true],
  ['panturrilha-leg-press', 'Panturrilha no leg press', 'Leg press calf raise', 'calves', [], 'machine', 'calfRaise', 'isolation', 'lightIsolation', 5, true],

  // Abdômen
  ['abdominal-polia', 'Abdominal na polia', 'Cable crunch', 'abs', [], 'cable', 'coreFlexion', 'isolation', 'lightIsolation', 2.5],
  ['abdominal-maquina', 'Abdominal na máquina', 'Machine crunch', 'abs', [], 'machine', 'coreFlexion', 'isolation', 'lightIsolation', 2.5],
  ['elevacao-pernas', 'Elevação de pernas na barra', 'Hanging leg raise', 'abs', [], 'bodyweight', 'coreFlexion', 'isolation', 'lightIsolation', 2.5],
  ['elevacao-pernas-paralela', 'Elevação de pernas na paralela', "Captain's chair leg raise", 'abs', [], 'bodyweight', 'coreFlexion', 'isolation', 'lightIsolation', 2.5],
  ['abdominal-supra', 'Abdominal supra', 'Crunch', 'abs', [], 'bodyweight', 'coreFlexion', 'isolation', 'lightIsolation', 2.5],
  ['roda-abdominal', 'Roda abdominal', 'Ab wheel rollout', 'abs', [], 'other', 'antiExtension', 'isolation', 'lightIsolation', 2.5],
]

export function seedExercises(now: number): Exercise[] {
  return ROWS.map(([id, namePt, nameEn, primary, secondary, equipment, pattern, category, rest, stepKg, lowerBody]) => ({
    id,
    namePt,
    nameEn,
    primaryMuscle: primary,
    secondaryMuscles: secondary,
    equipment,
    pattern,
    category,
    restProfile: rest,
    loadStepKg: stepKg,
    lowerBody: lowerBody ?? false,
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  }))
}
