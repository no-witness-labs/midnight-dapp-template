/**
 * Cleanup script for devnet Docker containers.
 *
 * Removes all midday-devnet containers (including faucet and fee relay) and network.
 *
 * Usage:
 *   pnpm stop
 */
import { Container } from '@no-witness-labs/midday-sdk/devnet';

const CLUSTER_NAME = 'midday-devnet';

const CONTAINER_NAMES = [
  `${CLUSTER_NAME}-node`,
  `${CLUSTER_NAME}-indexer`,
  `${CLUSTER_NAME}-proof-server`,
  `${CLUSTER_NAME}-faucet`,
  `${CLUSTER_NAME}-fee-relay`,
];

async function cleanup() {
  console.log('=== Cleaning up devnet containers ===\n');

  for (const name of CONTAINER_NAMES) {
    console.log(`Removing ${name}...`);
    await Container.removeByName(name);
  }

  console.log('\nRemoving network...');
  await Container.removeClusterNetwork(CLUSTER_NAME);

  console.log('\n=== Cleanup complete ===');
}

cleanup().catch((error) => {
  console.error('Cleanup error:', error);
  process.exit(1);
});
