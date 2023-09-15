const integTestWildcard = '${Token[AWS.Region';
// see https://aws.amazon.com/de/about-aws/whats-new/2023/09/amazon-ses-email-service-7-regions/
export const sesEnabledRegions = [
  'us-east-1', // US East (N. Virginia),
  'eu-west-1', // Europe (Ireland),
  'us-west-2', // US West (Oregon),
  // new regions since 2023-09
  'eu-central-1', // Europe (Frankfurt),
  'eu-west-2', // Europe (London),
  'us-east-2', // US East (Ohio),
  'ca-central-1', // Canada (Central),
  'ap-northeast-1', // Asia Pacific (Tokyo),
  'ap-southeast-1', // Asia Pacific (Singapore),
  'ap-southeast-2', // Asia Pacific (Sydney),
];

export function isSESEnabledRegion(region: string): boolean {
  return sesEnabledRegions.includes(region) || region.startsWith(integTestWildcard);
}