import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Handle unused variables more comprehensively
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "React|^_|Incident|CookieOptions", // Added Incident and CookieOptions
          args: "after-used",
          argsIgnorePattern: "^_|options", // Added options
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Add rule for React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          additionalHooks: "(useRecoilCallback|useRecoilTransaction_UNSTABLE)",
        },
      ],
    },
  },
];

export default eslintConfig;