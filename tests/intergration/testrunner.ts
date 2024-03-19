/**
 * @file Turns on Processes/Server and runs tests
 * @author Sebastian Gadzinski
 */

import fs from 'fs';
import path from 'path';
import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import chalk from 'chalk';
import { reject } from 'bluebird';

// Define the directory where tests are located.
const testsDir: string = './tests';
let testCompleted = 0;
let testsToComplete = 0;
let serverProcess: ChildProcessWithoutNullStreams;
let serverStarted = false;

/**
 * Run a test file using Node.js.
 * @param filePath - The path to the test file.
 */
async function startServer() {
  return new Promise((resolve) => {
    serverProcess = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', [
      'run',
      'start:test',
      '--inspect'
    ]);

    serverProcess.stdout.on('data', (data) => {
      if (!serverStarted && data.includes('App listening')) {
        resolve(true);
        serverStarted = true;
      }
      console.log(`stdout: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    serverProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Server process exited with code ${code}`);
      } else {
        console.log('Server process exited successfully.');
      }
    });
  });
}

/**
 * Run a test file using Node.js.
 * @param filePath - The path to the test file.
 */
function runTest(filePath: string): void {
  exec(
    `mocha --reporter json --check-leaks --require ts-node/register ${filePath}`,
    (error, stdout, stderr) => {
      console.log(chalk.blue(`Results for ${filePath}:\n`));

      if (stderr) {
        console.error(stderr);
      }
      if (stdout) {
        let { jsonObject, remainingString } = extractLastJson(stdout);
        console.log(remainingString);
        displayTestResults(jsonObject);

        console.log(``);

        testCompleted++;
        if (testCompleted == testsToComplete) {
          serverProcess?.kill();
          process.exit();
        }
      }
    }
  );
}

/**
 * Traverse a directory and return all test file paths.
 * If a subdirectory is found, it will recursively traverse that too.
 * @param directory - The directory to traverse.
 * @returns - Promise that resolves with an array of test file paths.
 */
function getTestFilePaths(directory: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let testFiles: string[] = [];

    fs.readdir(directory, (err, files) => {
      if (err) {
        reject(`Error reading directory: ${err.toString()}`);
        return;
      }

      const filePromises = files.map((file) => {
        const filePath: string = path.join(directory, file);

        return new Promise<string[]>((resolve, reject) => {
          fs.stat(filePath, (err, stats) => {
            if (err) {
              reject(`Error getting file stats:: ${err.toString()}`);
              return;
            }

            if (stats.isDirectory()) {
              getTestFilePaths(filePath).then(resolve).catch(reject);
            } else if (
              path.extname(file) === '.ts' &&
              file.endsWith('.spec.ts')
            ) {
              resolve([filePath]);
            } else {
              resolve([]);
            }
          });
        });
      });

      Promise.all(filePromises)
        .then((filePathsArray) => {
          testFiles = filePathsArray.flat();
          resolve(testFiles);
        })
        .catch(reject);
    });
  });
}

/**
 * Run all test files.
 * @param testFiles - Array of test file paths.
 */
function runAllTests(testFiles: string[]): void {
  testsToComplete = testFiles.length;
  testFiles.forEach((filePath) => {
    runTest(filePath);
  });
}

function displayTestResults(results: any): void {
  // Display overall stats
  // console.log(`Total Suites: ${results.stats.suites}`);
  // console.log(`Total Tests: ${results.stats.tests}`);
  console.log(chalk.green(`Passes: ${results.stats.passes}`));
  console.log(chalk.red(`Failures: ${results.stats.failures}`));
  console.log(`Duration: ${results.stats.duration}ms`);

  // Display individual test results
  results.tests.forEach((test: any) => {
    console.log(
      '\n' +
      chalk.bold(
        test.fullTitle.replace(test.title, '') +
        ' : ' +
        chalk.redBright(test.title)
      )
    );

    if (results.passes.some((pass: any) => pass.title === test.title)) {
      console.log(chalk.green('✓ Passed'));
    } else if (
      results.failures.some((fail: any) => fail.title === test.title)
    ) {
      console.log(chalk.red('✗ Failed'));
      const error = results.failures.find(
        (fail: any) => fail.title === test.title
      ).err;
      console.log(chalk.red(`Error: ${error.message}`)); // Assuming err is an Error object
    }
  });
}

function extractLastJson(inputString: string): {
  jsonObject: object | null;
  remainingString: string;
} {
  // Regular expression to match JSON-like structures
  const regex = /{[\s\S]*?}(?=\s*{|\s*$)/g;

  // Find all matches
  const matches = inputString.match(regex);

  // Get the last match
  const lastJsonObjectString = matches && matches[matches.length - 1];

  let jsonObject: object | null = null;
  if (lastJsonObjectString) {
    try {
      jsonObject = JSON.parse(lastJsonObjectString);
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  }

  // Extract the remaining string without the last JSON object
  const remainingString = lastJsonObjectString
    ? inputString.replace(lastJsonObjectString, '').trim()
    : inputString;

  return {
    jsonObject,
    remainingString
  };
}

//Start the server
startServer().then(() => {
  // Start the traversal with the tests directory.
  getTestFilePaths(testsDir)
    .then(runAllTests)
    .catch((error) => {
      console.error(error);
    });
});
