import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "no-constant-condition": [
        "error",
        {
          checkLoops: false,
        },
      ],
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
