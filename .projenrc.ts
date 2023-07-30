import { awscdk } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Manuel Vogel',
  authorAddress: 'mavogel@posteo.de',
  cdkVersion: '2.88.0',
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

  bundledDeps: [
    '@aws-cdk/aws-lambda-python-alpha@2.88.0-alpha.0',
    'aws-sdk',
    'axios',
    'uuid',
  ],
  description: 'An opinionated way to secure root email addresses for AWS accounts.',
  devDeps: [
    '@types/aws-lambda',
    '@types/axios',
    '@types/uuid',
    '@commitlint/cli',
    '@commitlint/config-conventional',
    'husky',
  ],
});

// project.package.setScript('prepare', 'husky install');
// project.package.setScript('pretest', 'make test');
project.gitignore.exclude('__pycache__');
project.gitignore.exclude('.pytest_cache');
project.gitignore.exclude('venv');
project.synth();