/**
 * Letters, phonics and early reading.
 *
 * Tier 1–2 stays on letter shapes and names, tier 3 adds sounds, tiers 4–5
 * move into blending whole words and rhyming.
 */

import { V } from '../engine/visual.js';
import { ALPHABET, LETTERS, CVC_WORDS, RHYMES, alphaFor, VOWELS } from '../data/content.js';
import { choiceFrom, byTier, scatterScene } from './util.js';

/** Letters that are easy to tell apart — used for the first tiers. */
const EASY_LETTERS = ['A', 'B', 'C', 'M', 'O', 'S', 'T', 'F', 'K', 'R', 'E', 'H'];

function letterPool(rng, tier, exclude = []) {
  const source = tier <= 2 ? EASY_LETTERS : LETTERS;
  return source.filter((l) => !exclude.includes(l));
}

/* -------------------------------------------------------------------------- */
/* 1. Find the letter                                                          */
/* -------------------------------------------------------------------------- */

const findLetter = {
  id: 'let-find',
  name: 'Find the letter',
  emoji: '🔠',
  blurb: 'Spot the right letter',
  gen(rng, tier) {
    const target = rng.pick(letterPool(rng, tier));
    const optionCount = byTier(tier, [3, 4, 4, 6, 6]);
    const lower = tier >= 3 && rng.chance(0.45);
    const distractors = rng.sample(letterPool(rng, tier, [target]), optionCount - 1);

    return choiceFrom(
      rng,
      [target, ...distractors],
      (l) => V.letter(l, lower),
      target,
      {
        prompt: `Find the letter ${lower ? target.toLowerCase() : target}`,
        speak: `Find the letter ${target}`,
        hint: `${target} is the ${ordinal(LETTERS.indexOf(target) + 1)} letter of the alphabet.`,
        columns: optionCount <= 4 ? 2 : 3,
        labelOf: (l) => `letter ${l}`,
      },
    );
  },
};

function ordinal(n) {
  const suffix = ['th', 'st', 'nd', 'rd'][(n % 100) - 20 > 0 && n % 10 < 4 ? n % 10 : n < 4 ? n : 0] || 'th';
  return `${n}${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* 2. Big & small letters                                                      */
/* -------------------------------------------------------------------------- */

const caseMatch = {
  id: 'let-case',
  name: 'Big & small',
  emoji: 'Aa',
  blurb: 'Match capitals to small letters',
  gen(rng, tier) {
    const target = rng.pick(letterPool(rng, tier));
    const optionCount = byTier(tier, [3, 3, 4, 4, 6]);
    const showUpper = rng.chance();
    const distractors = rng.sample(letterPool(rng, tier, [target]), optionCount - 1);

    return choiceFrom(
      rng,
      [target, ...distractors],
      (l) => V.letter(l, showUpper),
      target,
      {
        prompt: showUpper ? 'Find the small letter' : 'Find the big letter',
        speak: showUpper
          ? `Which is the small letter ${target}?`
          : `Which is the capital letter ${target}?`,
        stem: V.letter(target, !showUpper),
        hint: 'Big and small letters often look alike.',
        columns: optionCount <= 4 ? 2 : 3,
        labelOf: (l) => `letter ${l}`,
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Beginning sounds                                                         */
/* -------------------------------------------------------------------------- */

const beginningSound = {
  id: 'let-sound',
  name: 'First sound',
  emoji: '🔤',
  blurb: 'Which letter does it start with?',
  gen(rng, tier) {
    const optionCount = byTier(tier, [3, 3, 4, 4, 6]);
    const entry = rng.pick(tier <= 2 ? ALPHABET.filter((a) => EASY_LETTERS.includes(a.letter)) : ALPHABET);
    const [word, emoji] = rng.pick(entry.words);
    const reverse = tier >= 4 && rng.chance(0.4);

    if (reverse) {
      // Show a letter, pick the picture that starts with it.
      const others = rng.sample(
        ALPHABET.filter((a) => a.letter !== entry.letter),
        optionCount - 1,
      );
      const correct = { word, emoji, letter: entry.letter };
      const values = [correct, ...others.map((o) => ({ word: o.words[0][0], emoji: o.words[0][1], letter: o.letter }))];
      return choiceFrom(rng, values, (v) => V.emoji(v.emoji, 'lg'), correct, {
        key: (v) => v.letter,
        prompt: `Which one starts with ${entry.letter}?`,
        speak: `Which picture starts with the letter ${entry.letter}?`,
        stem: V.letter(entry.letter),
        hint: `Say each word out loud and listen to the first sound.`,
        columns: optionCount <= 4 ? 2 : 3,
        labelOf: (v) => v.word,
      });
    }

    const distractors = rng.sample(letterPool(rng, tier, [entry.letter]), optionCount - 1);
    return choiceFrom(rng, [entry.letter, ...distractors], (l) => V.letter(l), entry.letter, {
      prompt: `What does "${word}" start with?`,
      speak: `${word}. Which letter does ${word} start with?`,
      stem: V.emoji(emoji, 'xl'),
      stemCaption: word,
      hint: `Say it slowly: ${word[0]}‑${word.slice(1)}.`,
      columns: optionCount <= 4 ? 2 : 3,
      labelOf: (l) => `letter ${l}`,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Alphabet order                                                           */
/* -------------------------------------------------------------------------- */

const alphabetOrder = {
  id: 'let-order',
  name: 'Alphabet order',
  emoji: '🅰️',
  blurb: 'Which letter comes next?',
  rounds: 4,
  gen(rng, tier) {
    const sortMode = tier >= 3 && rng.chance(0.5);

    if (sortMode) {
      const count = byTier(tier, [3, 3, 4, 4, 5]);
      const start = rng.int(0, LETTERS.length - count);
      // Sometimes use non-adjacent letters so it is real sorting, not memory.
      const chosen =
        tier >= 4 && rng.chance(0.5)
          ? rng.sample(LETTERS, count).sort((a, b) => LETTERS.indexOf(a) - LETTERS.indexOf(b))
          : LETTERS.slice(start, start + count);

      return {
        type: 'order',
        prompt: 'Put the letters in order',
        speak: 'Tap the letters in alphabet order',
        trayLabel: 'A ➡️ Z',
        items: rng.shuffle(chosen).map((l) => ({ id: 'l' + l, visual: V.letter(l) })),
        answer: chosen.map((l) => 'l' + l),
        hint: 'Sing the alphabet song in your head.',
      };
    }

    const span = byTier(tier, [3, 4, 4, 5, 5]);
    const start = rng.int(0, LETTERS.length - span);
    const window = LETTERS.slice(start, start + span);
    const holeIndex = tier <= 2 ? window.length - 1 : rng.int(0, window.length - 1);
    const answer = window[holeIndex];

    const stem = V.stack(
      window.map((l, i) => (i === holeIndex ? V.blank() : V.letter(l, false))),
    );

    const distractors = rng.sample(
      LETTERS.filter((l) => !window.includes(l)),
      byTier(tier, [2, 3, 3, 3, 3]),
    );

    return choiceFrom(rng, [answer, ...distractors], (l) => V.letter(l), answer, {
      prompt: 'Which letter is missing?',
      speak: 'Which letter is missing?',
      stem,
      stemSize: 'md',
      hint: 'Say the alphabet from the beginning.',
      columns: 4,
      labelOf: (l) => `letter ${l}`,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* 5. Build the word                                                           */
/* -------------------------------------------------------------------------- */

const spelling = {
  id: 'let-spell',
  name: 'Build a word',
  emoji: '🧩',
  blurb: 'Drag the letters into place',
  rounds: 4,
  gen(rng, tier) {
    const [word, emoji] = rng.pick(CVC_WORDS);
    const letters = word.toUpperCase().split('');
    // Tier 1–2 pre-fill the first letter so there is less to do.
    const prefilled = tier <= 2 ? 1 : 0;
    const extraCount = byTier(tier, [0, 0, 1, 2, 3]);

    const items = [];
    letters.slice(prefilled).forEach((letter, i) => {
      items.push({ id: `w${i}`, letter, visual: V.letter(letter) });
    });
    rng
      .sample(LETTERS.filter((l) => !letters.includes(l)), extraCount)
      .forEach((letter, i) => items.push({ id: `x${i}`, letter, visual: V.letter(letter) }));

    const targets = letters.map((letter, i) => {
      if (i < prefilled) {
        // Already filled in for the youngest players — nothing can be dropped here.
        return { id: `s${i}`, accepts: [], visual: V.letter(letter), capacity: 0 };
      }
      return {
        id: `s${i}`,
        // A slot accepts any tray letter with the right character, which keeps
        // words with repeated letters (like "egg") solvable.
        accepts: items.filter((it) => it.letter === letter).map((it) => it.id),
        capacity: 1,
      };
    });

    return {
      type: 'dragdrop',
      layout: 'slots',
      prompt: `Spell "${word}"`,
      speak: `Spell the word ${word}`,
      stem: V.emoji(emoji, 'xl'),
      stemCaption: word,
      items: rng.shuffle(items),
      targets,
      targetColumns: letters.length,
      hint: `The word is ${word.toUpperCase().split('').join('‑')}.`,
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 6. Rhyming                                                                  */
/* -------------------------------------------------------------------------- */

const rhyming = {
  id: 'let-rhyme',
  name: 'Rhyme time',
  emoji: '🎵',
  blurb: 'Which words sound the same?',
  gen(rng, tier) {
    const familyIndex = rng.int(0, RHYMES.length - 1);
    const family = RHYMES[familyIndex];
    const [cue, match] = rng.sample(family, 2);

    const otherFamilies = RHYMES.filter((_, i) => i !== familyIndex);
    const optionCount = byTier(tier, [3, 3, 4, 4, 4]);
    const distractors = rng
      .sample(otherFamilies, optionCount - 1)
      .map((f) => rng.pick(f));

    return choiceFrom(
      rng,
      [match, ...distractors],
      (w) => V.emoji(w[1], 'lg'),
      match,
      {
        key: (w) => w[0],
        prompt: `Which one rhymes with "${cue[0]}"?`,
        speak: `${cue[0]}. Which word rhymes with ${cue[0]}?`,
        stem: V.emoji(cue[1], 'xl'),
        stemCaption: cue[0],
        hint: 'Rhyming words end with the same sound.',
        columns: optionCount <= 3 ? 3 : 2,
        labelOf: (w) => w[0],
      },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 7. Letter hunt                                                              */
/* -------------------------------------------------------------------------- */

const letterHunt = {
  id: 'let-hunt',
  name: 'Letter hunt',
  emoji: '🕵️',
  blurb: 'Tap every hidden letter',
  rounds: 3,
  gen(rng, tier) {
    const target = rng.pick(letterPool(rng, tier));
    const targetCount = byTier(tier, [3, 4, 5, 6, 7]);
    const noiseCount = byTier(tier, [5, 7, 10, 14, 18]);
    const mixedCase = tier >= 3;
    const others = LETTERS.filter((l) => l !== target);

    const entries = [
      ...Array.from({ length: targetCount }, () => ({
        emoji: mixedCase && rng.chance() ? target.toLowerCase() : target,
        isTarget: true,
      })),
      ...Array.from({ length: noiseCount }, () => {
        const l = rng.pick(others);
        return { emoji: mixedCase && rng.chance() ? l.toLowerCase() : l, isTarget: false };
      }),
    ];

    const scene = scatterScene(rng, rng.shuffle(entries), { minDist: tier >= 4 ? 11 : 14 });

    return {
      type: 'tapcount',
      prompt: `Tap every letter ${target}`,
      speak: `Find and tap every letter ${target}`,
      findEmoji: target,
      scene,
      targets: scene.map((s, i) => (s.isTarget ? i : -1)).filter((i) => i >= 0),
      hint: mixedCase ? 'Remember: big and small letters both count!' : 'Check every corner.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Letter memory                                                            */
/* -------------------------------------------------------------------------- */

const letterMemory = {
  id: 'let-memory',
  name: 'Letter pairs',
  emoji: '🃏',
  blurb: 'Match letters with pictures',
  rounds: 2,
  gen(rng, tier) {
    const pairCount = byTier(tier, [3, 4, 5, 6, 8]);
    const chosen = rng.sample(tier <= 2 ? EASY_LETTERS : LETTERS, pairCount);
    const picturesMode = tier >= 3;

    return {
      type: 'memory',
      prompt: 'Find the matching pairs',
      speak: picturesMode
        ? 'Match each letter to a picture that starts with it'
        : 'Match the big letter to the small letter',
      stemCaption: picturesMode ? 'Letter ➜ picture' : 'Big ➜ small',
      pairs: chosen.map((letter) => ({
        id: 'p' + letter,
        a: V.letter(letter),
        b: picturesMode
          ? V.emoji(alphaFor(letter).words[0][1], 'md')
          : V.letter(letter, true),
      })),
      hint: 'Turn cards over slowly and remember where they are.',
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 9. Vowel spotting                                                           */
/* -------------------------------------------------------------------------- */

const vowels = {
  id: 'let-vowel',
  name: 'Vowel sort',
  emoji: '🅾️',
  blurb: 'Sort vowels from consonants',
  rounds: 3,
  gen(rng, tier) {
    const perBin = byTier(tier, [2, 2, 3, 3, 4]);
    const chosenVowels = rng.sample(VOWELS, Math.min(perBin, VOWELS.length));
    const consonants = rng.sample(
      LETTERS.filter((l) => !VOWELS.includes(l)),
      perBin,
    );

    const items = rng.shuffle([
      ...chosenVowels.map((l) => ({ id: 'v' + l, letter: l, kind: 'vowel' })),
      ...consonants.map((l) => ({ id: 'c' + l, letter: l, kind: 'cons' })),
    ]);

    return {
      type: 'dragdrop',
      layout: 'bins',
      prompt: 'Sort the letters',
      speak: 'Put the vowels in one basket and the other letters in the second basket',
      items: items.map((it) => ({ id: it.id, visual: V.letter(it.letter) })),
      targets: [
        {
          id: 'binV',
          label: 'Vowels',
          visual: V.emoji('🎵', 'sm'),
          accepts: items.filter((i) => i.kind === 'vowel').map((i) => i.id),
        },
        {
          id: 'binC',
          label: 'Other letters',
          visual: V.emoji('🔡', 'sm'),
          accepts: items.filter((i) => i.kind === 'cons').map((i) => i.id),
        },
      ],
      targetColumns: 2,
      hint: 'The vowels are A, E, I, O and U.',
    };
  },
};

export const LETTER_SKILLS = [
  findLetter,
  caseMatch,
  beginningSound,
  alphabetOrder,
  spelling,
  rhyming,
  letterHunt,
  letterMemory,
  vowels,
];
