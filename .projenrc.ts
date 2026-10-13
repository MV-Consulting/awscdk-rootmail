import { MvcCdkConstructLibrary } from '@mavogel/mvc-projen';
import { javascript } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';

// `@mavogel/mvc-projen` pins its own `projen` dependency. Inherit that range
// for the top-level `projen` instead of mirroring it by hand, so an upgrade of
// mvc-projen can never leave two diverging `projen` copies installed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mvcProjenVersion: string = require('@mavogel/mvc-projen/package.json').dependencies.projen;

// While the two copies still differ (during `upgrade-main`, before this very
// synth has bumped the top-level one), classes from the top-level `projen`
// don't type-check against mvc-projen's (TS2322, "separate declarations of a
// private property"). Take `Transform` from the `projen` mvc-projen resolves.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { javascript: mvcJavascript } = require(require.resolve('projen', { paths: [require.resolve('@mavogel/mvc-projen')] }));

const project = new MvcCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: '8409778+mavogel@users.noreply.github.com',
  cdkVersion: '2.263.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.9.0',
  name: '@mavogel/awscdk-rootmail',
  projenrcTs: true,
  npmTrustedPublishing: true,
  repositoryUrl: 'https://github.com/mavogel/awscdk-rootmail',
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
  packageManager: javascript.NodePackageManager.NPM,
  // This repo has its own real source - don't let mvc-projen scaffold its
  // placeholder crd-example sample code on top of it.
  sampleCode: false,
  keywords: ['aws', 'cdk', 'ses', 'construct', 'rootmail'],
  tsconfig: {
    compilerOptions: {
      esModuleInterop: true,
    },
  },
  deps: [
    // Deliberately unversioned: projen treats a dep with an explicit version as
    // pinned - it lands in renovate's `ignoreDeps` and is only reachable through
    // `npm update`, which can never leave a 0.0.x caret range (^0.0.37 == 0.0.37).
    // Left unversioned, upgrade-main (npm-check-updates) and Renovate both bump it.
    '@mavogel/mvc-projen',
    'constructs@^10.5.1',
  ],
  // Keep the top-level `projen` devDependency aligned with mvc-projen's - otherwise
  // npm installs a second, nested `projen` for mvc-projen's synthesis, whose
  // builtin task names the top-level `projen` CLI can't resolve at runtime,
  // breaking `npx projen release` with "Cannot find module
  // '.../bump-version.task.js'". See mavogel/cdk-vscode-server's .projenrc.ts
  // for the same issue.
  projenVersion: mvcProjenVersion,
  // Exclude `projen` from auto-upgrade: it follows mvc-projen's pin (above).
  depsUpgradeOptions: {
    exclude: ['projen'],
    // The upgrade-main PR is opened as 'mvc-bot' via PROJEN_GITHUB_TOKEN, so
    // it relies on the Mergify rule that auto-approves 'author=mvc-bot' PRs
    // carrying this label.
    workflowOptions: {
      labels: ['auto-approve'],
    },
  },
  // Renovate instead of Dependabot: Dependabot runs with `lockfile-only`, so it
  // can never move a 0.0.x caret range such as mvc-projen's.
  dependabot: false,
  renovatebot: true,
  renovatebotOptions: {
    labels: ['dependencies', 'auto-approve'],
    // mvc-projen is bumped by upgrade-main only: a bump also changes projen-generated
    // files (package.json pins, workflows), which Renovate cannot regenerate, so its
    // package.json+lockfile-only PRs fail at `npm ci` before self-mutation can run.
    ignore: ['aws-cdk-lib', 'aws-cdk', 'projen', '@mavogel/mvc-projen'],
    // Keeps the 7-day cooldown the previous Dependabot config had.
    minimumReleaseAge: '7 days',
    overrideConfig: {
      extends: ['config:recommended', ':preserveSemverRanges'],
      platformAutomerge: true,
      packageRules: [
        {
          matchManagers: ['npm'],
          groupName: 'default',
          // Negations only: Renovate rejects '*' combined with other patterns
          // ("config-validation"), which silently halts all updates.
          matchPackageNames: ['!aws-cdk*', '!projen'],
          automerge: true,
        },
      ],
    },
  },

  bundledDeps: [
    '@aws-sdk/client-cloudwatch-logs',
    '@aws-sdk/client-route-53',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-ses',
    '@aws-sdk/client-ssm',
    'cdk-nag',
    'mailparser',
    'uuid',
  ],
  description: 'An opinionated way to secure root email addresses for AWS accounts.',
  devDeps: [
    // commit-and-tag-version 13 loads its changelog preset through the
    // root-level conventional-changelog-preset-loader, which resolves the
    // *hoisted* conventional-changelog-conventionalcommits. @commitlint pulls in
    // a 9.x that shadows CATV's own 10.x, and 9.x's string templates make
    // `projen release` fail with "headerPartial is not a function". A direct
    // 10.x dependency takes the root slot (commitlint keeps its 9.x nested).
    'conventional-changelog-conventionalcommits@^10.4.0',
    '@types/aws-lambda',
    '@types/jsonfile',
    '@types/mailparser',
    '@types/uuid',
    '@aws-cdk/integ-runner@2.197.4',
    '@aws-cdk/integ-tests-alpha@^2.243.0-alpha.0',
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'husky',
    'jsonfile',
  ],
  // `he` >= 2 (pulled in by mailparser) is ESM-only and Jest loads tests as
  // CommonJS, so compile it through ts-jest instead of pinning it to 1.x.
  jestOptions: {
    jestConfig: {
      transformIgnorePatterns: ['/node_modules/(?!he/)'],
      transform: {
        '^.+\\.mjs$': new mvcJavascript.Transform('ts-jest', { tsconfig: { allowJs: true, module: 'commonjs', esModuleInterop: true } }),
      },
    },
  },
  gitignore: [
    'venv',
    'cdk.out',
    'tmp',
  ],
});

// build.yml's `self-mutation` job needs the checkout's persisted credential
// to `git push` its patch back to the PR branch - extend mvc-projen's
// generated .github/zizmor.yml (which only covers dangerous-triggers) with
// this repo-specific artipacked exception. The line number is specific to
// this workflow's current shape; re-check it against `zizmor .` output if
// build.yml's job order changes.
project.tryFindObjectFile('.github/zizmor.yml')?.addOverride('rules.artipacked.ignore', ['build.yml:80']);

project.package.setScript('awslint', 'awslint -x prefer-ref-interface:aws-cdk-lib.*');
project.package.setScript('prepare', 'husky install');
project.package.setScript('prepare-integ-test', 'rm -rf cdk.out && npx cdk synth -q');
project.package.setScript('integ-test', 'integ-runner --directory ./integ-tests --parallel-regions eu-west-2 --parallel-regions eu-west-1 --update-on-failed');
project.synth();