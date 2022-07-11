#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the eslint command.
 * @author Nicholas C. Zakas
 */

/* eslint no-console:off -- CLI */

/*
 * to use V8's code cache to speed up instantiation time
 * seems no longer needed for esm
 * require("v8-compile-cache");
 */
import debug from "debug";
import fs from "fs";
import util from "util";

// must do this initialization *before* other requires in order to work
if (process.argv.includes("--debug")) {
    debug.enable("eslint:*,-eslint:code-path,eslintrc:*");
}

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Read data from stdin til the end.
 *
 * Note: See
 * - https://github.com/nodejs/node/blob/master/doc/api/process.md#processstdin
 * - https://github.com/nodejs/node/blob/master/doc/api/process.md#a-note-on-process-io
 * - https://lists.gnu.org/archive/html/bug-gnu-emacs/2016-01/msg00419.html
 * - https://github.com/nodejs/node/issues/7439 (historical)
 *
 * On Windows using `fs.readFileSync(STDIN_FILE_DESCRIPTOR, "utf8")` seems
 * to read 4096 bytes before blocking and never drains to read further data.
 *
 * The investigation on the Emacs thread indicates:
 *
 * > Emacs on MS-Windows uses pipes to communicate with subprocesses; a
 * > pipe on Windows has a 4K buffer. So as soon as Emacs writes more than
 * > 4096 bytes to the pipe, the pipe becomes full, and Emacs then waits for
 * > the subprocess to read its end of the pipe, at which time Emacs will
 * > write the rest of the stuff.
 * @returns {Promise<string>} The read text.
 */
function readStdin() {
    return new Promise((resolve, reject) => {
        let content = "";
        let chunk = "";

        process.stdin
            .setEncoding("utf8")
            .on("readable", () => {
                while ((chunk = process.stdin.read()) !== null) {
                    content += chunk;
                }
            })
            .on("end", () => resolve(content))
            .on("error", reject);
    });
}

/**
 * read a json file
 * @param {any} jsonPath the file path of the json file
 * @returns {Object} the parsed json object
 */
function readJsonSync(jsonPath) {
    const text = fs.readFileSync(new URL(jsonPath, import.meta.url), "utf8");

    return JSON.parse(text);
}

/**
 * Get the error message of a given value.
 * @param {any} error The value to get.
 * @returns {string} The error message.
 */
async function getErrorMessage(error) {

    // Foolproof -- thirdparty module might throw non-object.
    if (typeof error !== "object" || error === null) {
        return String(error);
    }

    // Use templates if `error.messageTemplate` is present.
    if (typeof error.messageTemplate === "string") {
        try {
            const template = (await import(`../messages/${error.messageTemplate}.js`)).default;

            return template(error.messageData || {});
        } catch {

            // Ignore template error then fallback to use `error.stack`.
        }
    }

    // Use the stacktrace if it's an error object.
    if (typeof error.stack === "string") {
        return error.stack;
    }

    // Otherwise, dump the object.
    return util.format("%o", error);
}

/**
 * Catch and report unexpected error.
 * @param {any} error The thrown error object.
 * @returns {void}
 */
async function onFatalError(error) {
    process.exitCode = 2;

    const { version } = readJsonSync("../package.json");
    const message = await getErrorMessage(error);

    console.error(`
Oops! Something went wrong! :(

ESLint: ${version}

${message}`);
}

//------------------------------------------------------------------------------
// Execution
//------------------------------------------------------------------------------

(async function main() {
    process.on("uncaughtException", onFatalError);
    process.on("unhandledRejection", onFatalError);

    // Call the config initializer if `--init` is present.
    if (process.argv.includes("--init")) {

        // `eslint --init` has been moved to `@eslint/create-config`
        console.warn("You can also run this command directly using 'npm init @eslint/config'.");

        const spawn = (await import("cross-spawn")).default;

        spawn.sync("npm", ["init", "@eslint/config"], { encoding: "utf8", stdio: "inherit" });
        return;
    }

    // Otherwise, call the CLI.
    const cli = (await import("../lib/cli.js")).default;

    process.exitCode = await cli.execute(
        process.argv,
        process.argv.includes("--stdin") ? await readStdin() : null,
        true
    );
}()).catch(onFatalError);
