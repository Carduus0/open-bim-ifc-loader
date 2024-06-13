import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import serve from "rollup-plugin-serve";
import copy from 'rollup-plugin-copy'

export default {
  input: "app.ts",
  output: [
    {
      format: "esm",
      file: "build/bundle.js",
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript(), // Добавляем поддержку TypeScript
    // terser(), // Опционально: минификация для продакшн-сборки
    serve({
      // Настраиваем плагин serve
      open: true, // Опционально: открыть в браузере автоматически
      contentBase: ["", "public"], // Корневые директории для сервера
      host: "localhost",
      port: 40023, // Порт, на котором будет запущен сервер
    }),
    copy({
      targets: [
        { src: ['index.html', 'styles.css'], dest: 'build' },
        { src: 'models', dest: 'build' },
        { src: 'web-ifc.wasm', dest: 'build' },
      ]
    }),
  ],
};
