import { awscdk } from 'projen';
import { JobPermission } from 'projen/lib/github/workflows-model';
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
  keywords: ['aws', 'cdk', 'ses', 'construct', 'rootmail'],
  autoApproveOptions: {
    allowedUsernames: ['mavogel'],
  },
  autoApproveUpgrades: true,
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
    },
  },
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
    '@aws-sdk/client-cloudwatch-logs',
    '@aws-sdk/client-route-53',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-ses',
    '@aws-sdk/client-ssm',
    'async-retry',
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

const releaseWorkflow = project.github!.workflows.find(w => w.name === 'release');

// for multi-line strings in YAML
// see https://github.com/projen/projen/blob/main/src/github/workflow-steps.ts#L46
const installBuildAndPublishAssetsDependenciesSteps = [
  'pip install cfn-flip && cfn-flip --version',
  'yarn global add aws-cdk',
  'yarn install --check-files --frozen-lockfile',
];

const buildAndPublishAssetsSteps = [
  'ROOTMAIL_VERSION=$(cat dist/releasetag.txt)',
  'echo "Release version: $ROOTMAIL_VERSION"',
  'npm test',
  'npm run synth',
  'npm run publish-assets',
  'aws s3 cp cdk.out/RootmailStack.template.json s3://${S3_PUBLISH_BUCKET}/${ROOTMAIL_VERSION}/templates/',
  'cfn-flip cdk.out/RootmailStack.template.json cdk.out/rootmail.template.yaml',
  'aws s3 cp cdk.out/rootmail.template.yaml s3://${S3_PUBLISH_BUCKET}/${ROOTMAIL_VERSION}/templates/',

];

if (releaseWorkflow) {
  releaseWorkflow.addJobs({
    release_s3: {
      runsOn: ['ubuntu-latest'],
      permissions: {
        idToken: JobPermission.WRITE,
        contents: JobPermission.READ,
      },
      needs: ['release'],
      if: 'needs.release.outputs.tag_exists != \'true\' && needs.release.outputs.latest_commit == github.sha',
      steps: [
        {
          name: 'Checkout',
          uses: 'actions/checkout@v4',
        },
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: {
            'node-version': '18.x',
          },
        },
        {
          name: 'Configure AWS credentials',
          uses: 'aws-actions/configure-aws-credentials@v4',
          with: {
            'aws-region': 'eu-central-1',
            'role-to-assume': 'arn:aws:iam::935897259846:role/gh-actions-awscdk-rootmail-Role-hejhEmbcI80y',
          },
        },
        {
          name: 'Install Build and publish assets dependencies',
          run: installBuildAndPublishAssetsDependenciesSteps.join('\n'),
        },
        // https://stackoverflow.com/questions/3790454/how-do-i-break-a-string-in-yaml-over-multiple-lines
        {
          name: 'Build and publish assets',
          run: buildAndPublishAssetsSteps.join('\n'),
          env: {
            S3_PUBLISH_BUCKET: 'mvc-test4-bucket-eu-west-1',
          },
        },
      ],
    },
  });

}

project.package.setScript('prepare', 'husky install');
project.package.setScript('integ-test', 'integ-runner --directory ./integ-tests --parallel-regions eu-west-2 --parallel-regions eu-west-1 --update-on-failed');
project.package.setScript('synth', 'cdk synth -q');
project.package.setScript('prepare-integ-test', 'rm -rf cdk.out && cdk synth -q');
project.package.setScript('publish-assets', 'npx ts-node -P tsconfig.json --prefer-ts-exts src/scripts/publish-assets.ts');
project.synth();