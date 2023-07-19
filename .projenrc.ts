import { awscdk } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';

const dependencies = [
  '@types/aws-lambda',
  'aws-sdk',
];

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: 'mavogel@posteo.de',
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.0.0',
  name: 'awscdk-rootmail',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/mavogel/awscdk-rootmail.git',
  npmAccess: NpmAccess.PUBLIC, /* The npm access level to use when releasing this module. */
  tsconfig: {
    compilerOptions: {
      esModuleInterop: true,
    },
  },

  bundledDeps: dependencies,
  deps: dependencies,
  description: 'An opinionated way to secure root email addresses for AWS accounts.',
  devDeps: [
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'husky',
  ],
});

project.package.setScript('prepare', 'husky install');
project.synth();