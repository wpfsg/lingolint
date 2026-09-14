import type { QARule } from '../types/rule.js';
import { duplicateTranslationRule } from './duplicate-translation.js';
import { emptyTranslationRule } from './empty-translation.js';
import { extraKeyRule } from './extra-key.js';
import { glossaryRule } from './glossary.js';
import { htmlTagsRule } from './html-tags.js';
import { identicalToSourceRule } from './identical-to-source.js';
import { lengthRule } from './length.js';
import { missingKeyRule } from './missing-key.js';
import { placeholdersRule } from './placeholders.js';
import { whitespaceRule } from './whitespace.js';

// Rules are typed with their own option shapes; the registry erases them.
// `run` is declared as a method so this assignment is type-safe.
export const builtinRules: readonly QARule[] = [
  missingKeyRule,
  extraKeyRule,
  emptyTranslationRule,
  placeholdersRule,
  htmlTagsRule,
  whitespaceRule,
  identicalToSourceRule,
  lengthRule,
  duplicateTranslationRule,
  glossaryRule,
] as readonly QARule[];

export {
  duplicateTranslationRule,
  emptyTranslationRule,
  extraKeyRule,
  glossaryRule,
  htmlTagsRule,
  identicalToSourceRule,
  lengthRule,
  missingKeyRule,
  placeholdersRule,
  whitespaceRule,
};
