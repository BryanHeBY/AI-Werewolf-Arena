module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  transform: {
    "^.+\.tsx?$": "ts-jest",
  },
  testRegex: "(/__tests__/.*|(\.|/)(test|spec))\.(ts|js)x?$",
};
