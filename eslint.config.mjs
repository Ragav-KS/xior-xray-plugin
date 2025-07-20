import eslint from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import { configs as tsESlintConfigs } from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  ...tsESlintConfigs.strict,
  ...tsESlintConfigs.stylistic,
  globalIgnores(['dist/*']),
];
