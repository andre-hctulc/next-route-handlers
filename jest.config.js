module.exports = {
    testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
    transform: {
        "^.+\\.tsx?$": "ts-jest",
    },
    verbose: true,
    rootDir: ".",
};
