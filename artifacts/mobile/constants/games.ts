export const GAME_INFO: Record<string, { title: string; description: string; color: string; icon: string; benefit: string }> = {
  'card-match': {
    title: 'Card Match',
    description: 'Find matching word pairs',
    color: '#6366F1',
    icon: 'copy',
    benefit: 'Improves visual memory & word recognition',
  },
  'balloon-pop': {
    title: 'Balloon Pop',
    description: 'Pop the right balloons',
    color: '#EF4444',
    icon: 'target',
    benefit: 'Builds phoneme awareness & speed',
  },
  'letter-sort': {
    title: 'Letter Sort',
    description: 'Build words from scrambled letters',
    color: '#10B981',
    icon: 'type',
    benefit: 'Strengthens spelling & letter ordering',
  },
  'word-scramble': {
    title: 'Word Scramble',
    description: 'Tap letters in the right order',
    color: '#F59E0B',
    icon: 'shuffle',
    benefit: 'Enhances phonological processing',
  },
  'cake-tower': {
    title: 'Cake Tower',
    description: 'Stack & time letter blocks',
    color: '#EC4899',
    icon: 'layers',
    benefit: 'Develops sequencing & visual tracking',
  },
  'sequence': {
    title: 'Memory Match',
    description: 'Remember and repeat sequences',
    color: '#8B5CF6',
    icon: 'list',
    benefit: 'Boosts working memory & attention',
  },
  'water-sort': {
    title: 'Water Sort',
    description: 'Sort colored liquids into tubes',
    color: '#06B6D4',
    icon: 'droplet',
    benefit: 'Trains visual discrimination & logic',
  },
  'fruit-crush': {
    title: 'Fruit Crush',
    description: 'Match 3 fruits — daily challenge',
    color: '#F97316',
    icon: 'grid',
    benefit: 'Builds pattern recognition & focus',
  },
};

export const DYSLEXIA_TYPES: Record<string, { label: string; description: string; color: string }> = {
  phonological: {
    label: 'Phonological',
    description: 'Difficulty connecting letters to sounds',
    color: '#6366F1',
  },
  visual: {
    label: 'Visual',
    description: 'Difficulty with letter shapes and orientation',
    color: '#EC4899',
  },
  'rapid-naming': {
    label: 'Rapid Naming',
    description: 'Slower processing of symbols and text',
    color: '#F59E0B',
  },
  surface: {
    label: 'Surface',
    description: 'Difficulty with irregular word spelling',
    color: '#10B981',
  },
  mixed: {
    label: 'Mixed',
    description: 'Combination of multiple dyslexia traits',
    color: '#8B5CF6',
  },
};

export const DYSLEXIA_LEVELS: Record<number, { label: string; description: string; color: string }> = {
  1: { label: 'Mild', description: 'Minor challenges with reading', color: '#10B981' },
  2: { label: 'Moderate', description: 'Noticeable reading difficulties', color: '#F59E0B' },
  3: { label: 'Severe', description: 'Significant reading challenges', color: '#EF4444' },
};

export const GAME_ROTATIONS: Record<string, string[]> = {
  phonological:   ['word-scramble', 'balloon-pop', 'letter-sort', 'card-match', 'sequence', 'fruit-crush', 'water-sort'],
  visual:         ['card-match', 'water-sort', 'cake-tower', 'balloon-pop', 'sequence', 'fruit-crush', 'letter-sort'],
  'rapid-naming': ['balloon-pop', 'sequence', 'card-match', 'word-scramble', 'letter-sort', 'fruit-crush', 'water-sort'],
  surface:        ['word-scramble', 'card-match', 'letter-sort', 'balloon-pop', 'cake-tower', 'water-sort', 'fruit-crush'],
  mixed:          ['card-match', 'balloon-pop', 'letter-sort', 'word-scramble', 'cake-tower', 'sequence', 'fruit-crush'],
  default:        ['card-match', 'balloon-pop', 'letter-sort', 'word-scramble', 'sequence', 'water-sort', 'fruit-crush'],
};

export const WORDS_BY_LEVEL: Record<number, string[]> = {
  1: ['CAT', 'DOG', 'HAT', 'SUN', 'RUN', 'CUP', 'BUS', 'PIG', 'HEN', 'BED'],
  2: ['FROG', 'STAR', 'BLUE', 'CAKE', 'BIKE', 'HOME', 'GAME', 'TREE', 'FISH', 'BIRD'],
  3: ['CHAIR', 'BRAIN', 'PLANT', 'CLOCK', 'STONE', 'BEACH', 'PHONE', 'LIGHT', 'CLOUD', 'FRUIT'],
  4: ['BUTTER', 'GARDEN', 'WINDOW', 'FINGER', 'YELLOW', 'PURPLE', 'FOLLOW', 'BOTTLE'],
  5: ['THROUGH', 'BECAUSE', 'BETWEEN', 'PROBLEM', 'SEVERAL', 'VILLAGE', 'MORNING'],
};

export const CARD_PAIRS_BY_LEVEL: Record<number, { word: string; match: string }[]> = {
  1: [
    { word: 'CAT', match: 'MEOW' }, { word: 'DOG', match: 'BARK' },
    { word: 'SUN', match: 'HOT' }, { word: 'ICE', match: 'COLD' },
    { word: 'BEE', match: 'BUZZ' }, { word: 'COW', match: 'MOO' },
    { word: 'PIG', match: 'OINK' }, { word: 'HEN', match: 'CLUCK' },
  ],
  2: [
    { word: 'HAPPY', match: 'JOY' }, { word: 'ANGRY', match: 'MAD' },
    { word: 'BIG', match: 'HUGE' }, { word: 'FAST', match: 'QUICK' },
    { word: 'SMALL', match: 'TINY' }, { word: 'DARK', match: 'NIGHT' },
    { word: 'HOT', match: 'WARM' }, { word: 'WET', match: 'DAMP' },
  ],
  3: [
    { word: 'BRAVE', match: 'BOLD' }, { word: 'SMART', match: 'CLEVER' },
    { word: 'LOUD', match: 'NOISY' }, { word: 'CLEAN', match: 'NEAT' },
    { word: 'KIND', match: 'GENTLE' }, { word: 'CALM', match: 'QUIET' },
    { word: 'SHINY', match: 'BRIGHT' }, { word: 'SHARP', match: 'KEEN' },
  ],
};

export const RHYME_QUESTIONS = [
  { word: 'CAT', options: ['BAT', 'DOG', 'SUN', 'BIG'], answer: 'BAT' },
  { word: 'SUN', options: ['CAT', 'RUN', 'BIG', 'HAT'], answer: 'RUN' },
  { word: 'HAT', options: ['DOG', 'SUN', 'MAT', 'BIG'], answer: 'MAT' },
  { word: 'BIG', options: ['FIG', 'CAT', 'SUN', 'HAT'], answer: 'FIG' },
  { word: 'BED', options: ['CAT', 'RED', 'SUN', 'BIG'], answer: 'RED' },
  { word: 'HOP', options: ['CAT', 'SUN', 'TOP', 'BIG'], answer: 'TOP' },
  { word: 'CAN', options: ['MAN', 'DOG', 'SUN', 'BIG'], answer: 'MAN' },
  { word: 'PIG', options: ['CAT', 'SUN', 'HAT', 'JIG'], answer: 'JIG' },
];

export const SPELLING_QUESTIONS = [
  { correct: 'THEIR', options: ['THEIR', 'THIER', 'THERE', 'THEAR'] },
  { correct: 'WHICH', options: ['WICH', 'WHICH', 'WICH', 'WHICK'] },
  { correct: 'FRIEND', options: ['FREIND', 'FRIEND', 'FREND', 'FRINND'] },
  { correct: 'BECAUSE', options: ['BECAUS', 'BECAWSE', 'BECAUSE', 'BECUSE'] },
  { correct: 'COULD', options: ['COUD', 'COULD', 'KOULD', 'COLUD'] },
  { correct: 'PEOPLE', options: ['PEPLE', 'PEEPLE', 'PEOPLE', 'PEPOL'] },
  { correct: 'NIGHT', options: ['NIGT', 'NIGHT', 'NIIGHT', 'NITE'] },
];

const _ALL_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

export const BALLOON_TARGETS_BY_LEVEL: Record<number, { target: string; distractors: string[] }[]> = {
  1: [
    { target: 'A', distractors: _ALL_LETTERS.filter(l => l !== 'A') },
    { target: 'B', distractors: _ALL_LETTERS.filter(l => l !== 'B') },
    { target: 'S', distractors: _ALL_LETTERS.filter(l => l !== 'S') },
  ],
  2: [
    { target: 'AT', distractors: ['AN','IN','ON','UP','IT','AM','AS','IF','OR','US','TO','GO','NO','BE','ME','MY','BY','DO','OF','SO'] },
    { target: 'IN', distractors: ['AT','AN','ON','UP','IT','AM','AS','IF','OR','US','TO','GO','NO','BE','ME','MY','BY','DO','OF','SO'] },
    { target: 'UP', distractors: ['AT','AN','IN','ON','IT','AM','AS','IF','OR','US','TO','GO','NO','BE','ME','MY','BY','DO','OF','SO'] },
  ],
  3: [
    { target: 'CAT', distractors: ['DOG','SUN','HAT','BAT','RAT','SAT','MAT','FAT','NAP','MAP','TAP','LAP','CAP','RAP','COP','CUP','CUT','COT','COB','COD'] },
    { target: 'SUN', distractors: ['CAT','DOG','HAT','RUN','BUN','FUN','GUN','PUN','TUN','DUN','SAN','SON','SIN','SEN','SAP','SUP','SUB','SUM','SUG','SUT'] },
    { target: 'DOG', distractors: ['CAT','SUN','HAT','LOG','HOG','FOG','BOG','COG','JOG','MOG','DIG','DUG','DAG','DIN','DIM','DIP','DIT','DIB','DOT','DOE'] },
  ],
};
