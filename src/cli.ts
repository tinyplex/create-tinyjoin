#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  createCLI,
  detectPackageManager,
  type ProjectConfig,
} from 'tinycreate';

const templateRoot = join(dirname(fileURLToPath(import.meta.url)), 'templates');
const args = process.argv.slice(2);

const optionCatalog = {
  command: 'npm create tinygres@latest --',
  nonInteractiveFlag: '--non-interactive',
  options: {
    projectName: {type: 'string', required: true},
    installAndRun: {
      values: [true, false],
      required: true,
      recommendedForAgents: false,
    },
  },
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`create-tinygres

Interactively scaffold a TinyGres application:
  npm create tinygres@latest

Run non-interactively:
  npm create tinygres@latest -- --non-interactive \\
    --projectName my-tinygres-app --installAndRun false

Agent and automation commands:
  --list-options  Print the current option catalog as JSON
  --help          Show this help`);
  process.exit(0);
}

if (args.includes('--list-options')) {
  console.log(JSON.stringify(optionCatalog, null, 2));
  process.exit(0);
}

const config = {
  welcomeMessage: '🎉 Welcome to TinyGres!\n',
  questions: [
    {
      type: 'text' as const,
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-tinygres-app',
      validate: validateProjectName,
    },
    {
      type: 'confirm' as const,
      name: 'installAndRun',
      message: 'Install dependencies and start the demo?',
      initial: true,
    },
  ],
  createContext: (answers: Record<string, unknown>) => {
    const projectName = String(answers.projectName ?? '').trim();
    const validation = validateProjectName(projectName);
    if (validation !== true) {
      throw new TypeError(validation);
    }
    return {
      projectName,
      installAndRun:
        answers.installAndRun === true || answers.installAndRun === 'true',
      tinygresDependency:
        process.env.CREATE_TINYGRES_DEPENDENCY ?? '^0.0.0',
    };
  },
  getFiles: () => [
    {template: 'README.md.hbs', output: 'README.md', prettier: true},
    {template: 'AGENTS.md.hbs', output: 'AGENTS.md', prettier: true},
    {
      template: 'client/package.json.hbs',
      output: 'client/package.json',
      prettier: true,
    },
    {
      template: 'client/.gitignore.hbs',
      output: 'client/.gitignore',
    },
    {
      template: 'client/index.html.hbs',
      output: 'client/index.html',
      prettier: true,
    },
    {
      template: 'client/tsconfig.json.hbs',
      output: 'client/tsconfig.json',
      prettier: true,
    },
    {
      template: 'client/src/main.ts.hbs',
      output: 'client/src/main.ts',
      prettier: true,
    },
    {
      template: 'client/src/style.css.hbs',
      output: 'client/src/style.css',
      prettier: true,
    },
    {
      template: 'client/src/vite-env.d.ts.hbs',
      output: 'client/src/vite-env.d.ts',
      prettier: true,
    },
  ],
  templateRoot,
  installCommand: '{pm} install',
  devCommand: '{pm} run dev',
  workingDirectory: 'client',
  onSuccess: (projectName: string) => {
    const packageManager = detectPackageManager();
    console.log('Next steps:');
    console.log(`  cd ${projectName}/client`);
    console.log(`  ${packageManager} install`);
    console.log(`  ${packageManager} run dev`);
  },
} satisfies ProjectConfig;

createCLI(config).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function validateProjectName(value: string): true | string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value) || value === '.' || value === '..') {
    return 'Use letters, numbers, dots, dashes, or underscores without path separators.';
  }
  if (existsSync(join(process.cwd(), value))) {
    return `Directory "${value}" already exists. Choose a different name.`;
  }
  return true;
}
