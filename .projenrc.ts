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
  repositoryUrl: 'https://github.com/MV-Consulting/awscdk-rootmail',
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

// START custom workflow
const buildWorkflow = project.github!.workflows.find(w => w.name === 'build');
const releaseWorkflow = project.github!.workflows.find(w => w.name === 'release');

// general
const releaseRetries = '20'; // needs to be a string and will be parsed
// comma separated list of regions
const releaseRegions = 'eu-central-1,eu-west-1';
const releasePrefix = 'rootmail'; // will be used as prefix for the S3 path
// dev
const devS3PublishBucket = 'mvc-tmp-dev-releases';
const devS3FileAssetsBucketPrefix = 'mvc-tmp-dev-assets'; // will get '${AWS::Region}' appended
// prod
const prodS3PublishBucket = 'mvc-tmp-prod-releases';
const prodS3FileAssetsBucketPrefix = 'mvc-tmp-prod-assets'; // will get '${AWS::Region}' appended

const packageManager = project.package.packageManager;
switch (packageManager) {
  case 'yarn':
  case 'yarn2':
  case 'yarn_classic':
  case 'yarn_berry':
    // only yarn is supported atm
    break;
  case 'npm':
  case 'pnpm':
  case 'bun':
  default:
    throw new Error(`Unsupported package manager atm: ${packageManager}`);
}

// for multi-line strings in YAML
// see https://github.com/projen/projen/blob/main/src/github/workflow-steps.ts#L46
const installToolDependenciesSteps = [
  'pip install cfn-flip && cfn-flip --version',
  'yarn global add aws-cdk',
];

const buildAndPublishAssetsSteps = [
  'export RELEASE_NAME=${CI_REPOSITORY_NAME}',
  'export RELEASE_VERSION=$(cat $GITHUB_WORKSPACE/dist/releasetag.txt)',
  'echo "Releasing ${CI_REPOSITORY_NAME} with prefix ${RELEASE_PREFIX} and version ${RELEASE_VERSION} to S3 bucket ${S3_PUBLISH_BUCKET} and file assets bucket prefix ${S3_FILE_ASSETS_BUCKET_PREFIX}"',
  'yarn install',
  'yarn synth',
  'yarn publish-assets',
  'aws s3 cp cdk.out/${RELEASE_NAME}.template.json s3://${S3_PUBLISH_BUCKET}/${RELEASE_PREFIX}/${RELEASE_VERSION}/',
  'cfn-flip cdk.out/${RELEASE_NAME}.template.json cdk.out/${RELEASE_NAME}.template.yaml',
  'aws s3 cp cdk.out/${RELEASE_NAME}.template.yaml s3://${S3_PUBLISH_BUCKET}/${RELEASE_PREFIX}/${RELEASE_VERSION}/',
];

if (buildWorkflow) {
  buildWorkflow.addJobs({
    release_s3_dev: {
      name: 'Release to S3 (dev)',
      runsOn: ['ubuntu-latest'],
      needs: ['build'],
      // self-mutation did not happen and the PR is from the same repo
      if: '!(needs.build.outputs.self_mutation_happened) && !(github.event.pull_request.head.repo.full_name != github.repository)',
      permissions: {
        idToken: JobPermission.WRITE,
        contents: JobPermission.READ,
      },
      steps: [
        {
          name: 'Checkout',
          uses: 'actions/checkout@v4',
        },
        {
          name: 'Configure AWS credentials',
          uses: 'aws-actions/configure-aws-credentials@v4',
          with: {
            'aws-region': 'eu-west-1',
            'role-to-assume': '${{ secrets.DEV_RELEASE_ROLE }}',
          },
        },
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: {
            'node-version': '18.x',
          },
        },
        {
          name: 'Install Build and publish assets dependencies',
          run: installToolDependenciesSteps.join('\n'),
        },
        {
          name: 'Additional install, build and synth',
          run: 'yarn install && yarn build',
        },
        // NOTE: due to https://stackoverflow.com/questions/58033366/how-to-get-the-current-branch-within-github-actions
        // so we can use envs such as CI_HEAD_REF_SLUG
        {
          name: 'Inject environment variables',
          uses: 'FranzDiebold/github-env-vars-action@v2',
        },
        {
          name: 'Prepare version for branch',
          run: [
            'mkdir -p $GITHUB_WORKSPACE/dist',
            'echo "0.0.0-${CI_HEAD_REF_SLUG}-$(date -u +\'%Y%m%d-%H%M%S\')-${GITHUB_SHA::8}" > $GITHUB_WORKSPACE/dist/releasetag.txt',
          ].join('\n'),
        },
        {
          name: 'Build and publish assets',
          run: buildAndPublishAssetsSteps.join('\n'),
          env: {
            S3_PUBLISH_BUCKET: devS3PublishBucket,
            S3_FILE_ASSETS_BUCKET_PREFIX: devS3FileAssetsBucketPrefix,
            RELEASE_RETRIES: releaseRetries,
            RELEASE_REGIONS: releaseRegions,
            RELEASE_PREFIX: releasePrefix,
          },
        },
      ],
    },
  });
};

if (releaseWorkflow) {
  releaseWorkflow.addJobs({
    release_s3: {
      name: 'Release to S3',
      runsOn: ['ubuntu-latest'],
      permissions: {
        idToken: JobPermission.WRITE,
        contents: JobPermission.READ,
      },
      needs: ['release'],
      if: 'needs.release.outputs.tag_exists != \'true\' && needs.release.outputs.latest_commit == github.sha',
      steps: [
        // TODO pass in AccountId and roleName as secrets, so they are not passed
        // as plain text in the workflow and even more important, not passed to forks
        // see https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#using-secrets-in-a-workflow
        // NOTE: anyway it's tied to the ghOrg and reponame and you see it in the log of the action anyway
        {
          name: 'Configure AWS credentials',
          uses: 'aws-actions/configure-aws-credentials@v4',
          with: {
            'aws-region': 'eu-west-1',
            'role-to-assume': '${{ secrets.PROD_RELEASE_ROLE }}',
          },
        },
        {
          name: 'Setup Node.js',
          uses: 'actions/setup-node@v4',
          with: {
            'node-version': '18.x',
          },
        },
        // As in the other release jobs
        {
          name: 'Download build artifacts',
          uses: 'actions/download-artifact@v4',
          with: {
            name: 'build-artifact',
            path: 'dist',
          },
        },
        {
          name: 'Restore build artifact permissions',
          run: 'cd dist && setfacl --restore=permissions-backup.acl',
          continueOnError: true,
        },
        {
          name: 'Prepare Repository',
          run: 'mv dist .repo',
        },
        // Collect GitHub Metadata, such as, changelog.md, releasetag.txt, version.txt
        {
          name: 'Collect GitHub Metadata',
          run: 'mv .repo/dist dist',
        },
        {
          name: 'Install Build and publish assets dependencies',
          run: installToolDependenciesSteps.join('\n'),
        },
        {
          name: 'Build and publish assets',
          run: buildAndPublishAssetsSteps.join('\n'),
          env: {
            S3_PUBLISH_BUCKET: prodS3PublishBucket,
            S3_FILE_ASSETS_BUCKET_PREFIX: prodS3FileAssetsBucketPrefix,
            RELEASE_RETRIES: releaseRetries,
            RELEASE_REGIONS: releaseRegions,
            RELEASE_PREFIX: releasePrefix,
          },
          // Note: in the 'Prepare Repository' step we move the dist folder to .repo
          workingDirectory: '.repo',
        },
      ],
    },
  });
}
project.package.setScript('synth', 'npx cdk synth -q');
project.package.setScript('publish-assets', 'npx ts-node -P tsconfig.json --prefer-ts-exts src/scripts/publish-assets.ts');
// END custom workflow
project.package.setScript('prepare', 'husky install');
project.package.setScript('prepare-integ-test', 'rm -rf cdk.out && npx cdk synth -q');
project.package.setScript('integ-test', 'integ-runner --directory ./integ-tests --parallel-regions eu-west-2 --parallel-regions eu-west-1 --update-on-failed');
project.synth();