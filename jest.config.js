export default {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  bail: false,
  verbose: true,
  injectGlobals: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    '**/*.js',
    '!node_modules/**',
    '!dist/**',
    '!tests/**'
  ],
  moduleNameMapper: {
    '^../../utils/smsService.js$': '<rootDir>/tests/mocks/smsService.js'
  }
};
