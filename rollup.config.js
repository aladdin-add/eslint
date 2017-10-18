// rollup.config.js
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import json from "rollup-plugin-json";
import builtins from 'rollup-plugin-node-builtins';
export default [{
    input: "./tmp/linter.js",
    output: {
        file: "eslint.js",
        format: "umd"
    },
    name: "eslint",
    plugins: [
        resolve({
            extensions: ['.js', '.json'],
            preferBuiltins: true
        }),
        commonjs(),
        json(),
        builtins()
    ]
}];
