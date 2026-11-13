// Candidate driver-name merges (spec §13.1, Appendix A).
//
// Curated by hand — do NOT auto-apply. Each entry is a group of name spellings
// that most likely denote the same person; the in-app merge lets a human pick the
// survivor and folds the others into it. Names are matched to `drivers` rows by
// `normName` (upper-case, accent-folded, whitespace-collapsed).
//
// `confidence: 'low'` groups are the Appendix-A "verify before merging" ones.
export const DRIVER_MERGE_CANDIDATES = [
  // --- high confidence ---
  { confidence: 'high', names: ['EL QUARS REGRAGUI', 'REGRAGUI EL QUARS'] },
  { confidence: 'high', names: ['ATIQ ABDEKHALEK', 'ATIQ ABDELKHALEK'] },
  { confidence: 'high', names: ['BELMOUNATI LHABIB', 'BELMOUNATI LHBIB'] },
  { confidence: 'high', names: ['AIT BEN HAMED HASSAN', 'AIT BEN HAMID HASSAN'] },
  { confidence: 'high', names: ['LAHCEN OUHADDOU', 'LAHCEN OUHADOU'] },
  { confidence: 'high', names: ['ASKOUK LHOCINE', 'ASKOUK LHOUCINE'] },
  { confidence: 'high', names: ['ATTAR RACHID', 'EL ATTAR RACHID'] },
  { confidence: 'high', names: ['AZDDINE SABER', 'AZDINE SABER'] },
  { confidence: 'high', names: ['HAIDAR NOURDDINE', 'HAIDAR NOUREDDINE'] },
  { confidence: 'high', names: ['BOULHRI MOHAMED', 'MOHAMED BOULHRI'] },
  { confidence: 'high', names: ['EL MADANI SAMIR', 'SAMIR EL MADANI'] },
  { confidence: 'high', names: ['KASEM TOTO', 'TOTO KASEM'] },
  { confidence: 'high', names: ['CHAKIR SAID', 'SAID CHAKIR'] },
  { confidence: 'high', names: ['KASMI SALAH', 'SALAH KASMI'] },
  { confidence: 'high', names: ['AZOUZ KHALID', 'KHALID AZOUZ'] },

  // --- lower confidence (verify before merging) ---
  { confidence: 'low', names: ['HAMADI MUSTAPHA', 'HMADI MUSTAPHA'] },
  { confidence: 'low', names: ['AMGHID MUSTAPHA', 'AUGHID MUSTAPHA'] },
  { confidence: 'low', names: ['RACHID MOHAMED', 'RACHIDI MOHAMED', 'RACHDI MOHAMED'] },
  { confidence: 'low', names: ['NEGGAY SGHIR', 'NEGUAY SGHIR'] },
  { confidence: 'low', names: ['EL HYA YOUSSEF', 'EL NYA YOUSSEF'] },
  { confidence: 'low', names: ['BAKRAOUI RACHID', 'BEKRAOUI RACHID'] },
  { confidence: 'low', names: ['CHAIT MOHAMED', 'ECHAIT MOHAMED', 'ECHAYET MOHAMED'] },
  { confidence: 'low', names: ['EL BAYHAKI MOHAMED', 'EL BEYHAKI MOHAMED'] },
  { confidence: 'low', names: ['GZOULI ABDERRAZEK', 'LAGZOULI ABDERRAZEK'] },
  { confidence: 'low', names: ['BOUHMI MOHAMED', 'BOULHRI MOHAMED'] },
  { confidence: 'low', names: ['KAKTA HOUMAD', 'LAKTAM HOUMAD'] },
  { confidence: 'low', names: ['REGIGI MOHAMED', 'REGUIG MOHAMED'] },
]
