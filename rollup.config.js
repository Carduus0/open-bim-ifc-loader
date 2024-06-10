import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

export default {
  input: "app.ts",
  output: [
    {
      format: "esm",
      file: "bundle.js",
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript(), // Добавляем поддержку TypeScript
    // terser(), // Опционально: минификация для продакшн-сборки
  ],
};
