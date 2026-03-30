export { default as en } from './en';
export { default as ja } from './ja';
export type Translations = typeof import('./en').default;
