/**
 * Specs Inc. 2026
 * PromptBank — static list of English sentences for the spell-casting round.
 * Tiered by difficulty so we can scale spell power to challenge later.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface Prompt {
  english: string;
  difficulty: Difficulty;
}

const PROMPTS: Prompt[] = [
  // Easy — short, common, simple grammar
  { english: "The cat is sleeping.", difficulty: "easy" },
  { english: "I am hungry.", difficulty: "easy" },
  { english: "Where is the bathroom?", difficulty: "easy" },
  { english: "Hello, how are you?", difficulty: "easy" },
  { english: "Good morning.", difficulty: "easy" },
  { english: "I love pizza.", difficulty: "easy" },
  { english: "The dog is brown.", difficulty: "easy" },
  { english: "She is my friend.", difficulty: "easy" },
  { english: "I want water.", difficulty: "easy" },
  { english: "What time is it?", difficulty: "easy" },
  { english: "Open the door.", difficulty: "easy" },
  { english: "I am tired.", difficulty: "easy" },
  { english: "Today is sunny.", difficulty: "easy" },
  { english: "I need help.", difficulty: "easy" },
  { english: "The car is fast.", difficulty: "easy" },
  { english: "My name is Sam.", difficulty: "easy" },
  { english: "Thank you very much.", difficulty: "easy" },
  { english: "See you tomorrow.", difficulty: "easy" },

  // Medium — full sentences, prepositions, basic conjugation
  { english: "She runs every morning.", difficulty: "medium" },
  { english: "We will travel tomorrow.", difficulty: "medium" },
  { english: "I would like a coffee, please.", difficulty: "medium" },
  { english: "Can you help me find the museum?", difficulty: "medium" },
  { english: "She works at the hospital.", difficulty: "medium" },
  { english: "We are going to the beach.", difficulty: "medium" },
  { english: "The book is on the table.", difficulty: "medium" },
  { english: "I do not understand the question.", difficulty: "medium" },
  { english: "He plays soccer every weekend.", difficulty: "medium" },
  { english: "My sister is a teacher.", difficulty: "medium" },
  { english: "The food was delicious.", difficulty: "medium" },
  { english: "I have two brothers and one sister.", difficulty: "medium" },
  { english: "Please speak more slowly.", difficulty: "medium" },
  { english: "I need to buy some bread.", difficulty: "medium" },
  { english: "The train leaves at eight o'clock.", difficulty: "medium" },
  { english: "My favorite color is blue.", difficulty: "medium" },

  // Hard — complex grammar, conditionals, subordinate clauses
  { english: "If it rains, we stay home.", difficulty: "hard" },
  { english: "Although it was raining, we went hiking.", difficulty: "hard" },
  { english: "If I had known, I would have come earlier.", difficulty: "hard" },
  { english: "The book that I read yesterday was fascinating.", difficulty: "hard" },
  { english: "She told me that her flight had been canceled.", difficulty: "hard" },
  { english: "Despite the difficulties, they completed the project.", difficulty: "hard" },
  { english: "By the time we arrived, the meeting had ended.", difficulty: "hard" },
  { english: "I wish I could speak more languages fluently.", difficulty: "hard" },
];

export class PromptBank {
  static getAll(difficulty?: Difficulty): Prompt[] {
    if (!difficulty) return PROMPTS.slice();
    return PROMPTS.filter((p) => p.difficulty === difficulty);
  }

  static random(difficulty?: Difficulty): Prompt {
    const pool = PromptBank.getAll(difficulty);
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }
}
