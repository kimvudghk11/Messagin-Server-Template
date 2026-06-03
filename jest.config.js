/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { strictPropertyInitialization: false } }],
  },
  collectCoverageFrom: ['apps/**/*.ts', 'libs/**/*.ts', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src$1',
    '^@app/contracts(|/.*)$': '<rootDir>/libs/contracts/src$1',
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src$1',
    '^@app/auth(|/.*)$': '<rootDir>/libs/auth/src$1',
    '^@app/kafka(|/.*)$': '<rootDir>/libs/kafka/src$1',
  },
};
