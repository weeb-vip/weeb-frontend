/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  passWithNoTests: true,
  moduleNameMapper: {
    "^.+\\.svg$": "<rootDir>/__mocks__/svgrMock.ts",
  },
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/**/*.spec.(js|jsx|ts|tsx)"],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
};
