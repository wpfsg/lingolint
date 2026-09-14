import de from '../../../../examples/basic/de.json';
import en from '../../../../examples/basic/en.json';
import es from '../../../../examples/basic/es.json';
import { parseLocaleText, type LoadedLocale } from './files.js';

/** The repository's demo project, bundled so the UI is useful with zero setup. */
export function loadExampleProject(): LoadedLocale[] {
  return [
    parseLocaleText('en.json', JSON.stringify(en)),
    parseLocaleText('es.json', JSON.stringify(es)),
    parseLocaleText('de.json', JSON.stringify(de)),
  ];
}
