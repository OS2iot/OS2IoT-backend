module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "tsconfig.json",
        sourceType: "module",
    },
    plugins: ["@typescript-eslint/eslint-plugin"],
    extends: [
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
        "prettier/@typescript-eslint",
    ],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    rules: {
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-floating-promises": "warn",
        "max-lines-per-function": ["error", 80],
        "max-lines-per-function": ["warn", 40],
    },
    overrides: [
        {
            files: ["test/**/*.ts", "src/migration/*.ts"],
            rules: {
                "max-lines-per-function": "off",
            },
        },
    ],
};
