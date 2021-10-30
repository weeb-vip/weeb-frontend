module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'plugin:react/recommended',
    'airbnb',
    'plugin:react-svg/recommended',
    'plugin:jest/recommended',
    'plugin:testing-library/react',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    '@typescript-eslint',
    'react-svg',
    'testing-library',
    'jest',
  ],
  rules: {
    semi: ['error', 'never'],
    '@typescript-eslint/semi': 'off',
    quotes: ['error', 'single'],
    'no-console': ['error', { allow: [''] }],
    indent: ['error', 2],
    'no-tabs': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'react/jsx-filename-extension': [1, { extensions: ['.tsx'] }],
    'react/jsx-props-no-spreading': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        ts: 'never',
        tsx: 'never',
      },
    ],
    'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/*.test.tsx', '**/*.spec.tsx'] }],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': ['error', { variables: false }],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    camelcase: ['error'],
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'property', format: ['camelCase', 'snake_case', 'PascalCase'] },
    ],
    'max-len': [
      'error',
      {
        code: 100,
        ignoreComments: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    'implicit-arrow-linebreak': 'off',
    'linebreak-style': 0,
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        camelcase: ['off'],
      },
    },
  ],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.svg'],
      },
    },
  },
}
