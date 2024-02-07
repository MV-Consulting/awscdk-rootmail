import { awscdk } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: 'mavogel@posteo.de',
  cdkVersion: '2.90.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.3.0',
  name: '@mavogel/awscdk-rootmail',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/mavogel/awscdk-rootmail.git',
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
  tsconfig: {
    compilerOptions: {
      esModuleInterop: true,
    },
  },
  tsconfigDev: {
    compilerOptions: {
    },
    include: [
      'integ-tests/**/*.ts',
    ],
  },

  bundledDeps: [
    'async-retry',
    'aws-sdk',
    'axios',
    'cdk-nag',
    'mailparser',
    'uuid',
  ],
  description: 'An opinionated way to secure root email addresses for AWS accounts.',
  devDeps: [
    '@types/async-retry',
    '@types/aws-lambda',
    '@types/axios',
    '@types/jsonfile',
    '@types/mailparser',
    '@types/uuid',
    '@aws-cdk/integ-runner@^2.90.0-alpha.0',
    '@aws-cdk/integ-tests-alpha@^2.90.0-alpha.0',
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'cdk-assets',
    'husky',
    'jsonfile',
  ],
  gitignore: [
    'venv',
    'cdk.out',
  ],
});

project.package.setScript('prepare', 'husky install');
project.package.setScript('integ-test', 'integ-runner --directory ./integ-tests --parallel-regions eu-west-1 --update-on-failed');
project.package.setScript('synth', 'cdk synth -q');
project.package.setScript('publish-assets', 'npx ts-node -P tsconfig.json --prefer-ts-exts src/scripts/publish-assets.ts');
project.synth();