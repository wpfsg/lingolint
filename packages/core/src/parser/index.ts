export {
  FlattenError,
  KEY_SEPARATOR,
  applyFlatValues,
  flattenTranslations,
  isFlat,
  removeFlatKeys,
  unflattenTranslations,
} from './flatten.js';
export { jsonParser, parseJsonTranslations, type ParseJsonOptions } from './json.js';
export { getParserForFile, registerParser, supportedExtensions } from './registry.js';
export {
  LocaleParseError,
  type LocaleFileParser,
  type LocaleParseErrorInfo,
  type ParseOptions,
  type ParsedLocale,
} from './types.js';
