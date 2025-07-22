// prettier.config.cjs
/* Prettier configuration with 4-space indentation */
module.exports = {
    tabWidth: 4,
    useTabs: false,
    plugins: ["prettier-plugin-organize-imports", "prettier-plugin-sh"],
    overrides: [
        {
            files: ".husky/**",
            options: {
                plugins: [],
            },
        },
        {
            files: "Dockerfile",
            options: {
                plugins: [],
            },
        },
    ],
};
