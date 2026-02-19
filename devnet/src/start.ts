/**
 * Start local devnet cluster with faucet and fee relay.
 *
 * Prerequisites:
 * - Docker installed and running
 * - Sufficient system resources for Midnight containers
 *
 * Usage:
 *   pnpm devnet
 */
import { Cluster, Faucet, FeeRelay } from '@no-witness-labs/midday-sdk/devnet';

async function main() {
  console.log('=== Starting Devnet ===\n');

  console.log('1. Creating devnet cluster...');
  let cluster: Cluster.Cluster;

  try {
    cluster = await Cluster.make();
    console.log('   Cluster created');
  } catch (error) {
    console.error('Failed to create cluster:');
    if (error && typeof error === 'object' && 'cause' in error) {
      console.error('Cause:', (error as { cause: unknown }).cause);
    }
    throw error;
  }

  try {
    console.log('\n2. Starting devnet cluster (this may take a few minutes)...');
    await cluster.start();
    console.log('   Cluster started successfully!');

    console.log('\n3. Network configuration:');
    const networkConfig = cluster.networkConfig;
    console.log(`   Network ID: ${networkConfig.networkId}`);
    console.log(`   Indexer: ${networkConfig.indexer}`);
    console.log(`   Node: ${networkConfig.node}`);
    console.log(`   Proof Server: ${networkConfig.proofServer}`);

    console.log('\n4. Starting faucet and fee relay...');
    await Faucet.startDocker(cluster.networkConfig);
    console.log('   Faucet: http://localhost:3001/faucet');
    await FeeRelay.startDocker(cluster.networkConfig);
    console.log('   Fee relay: http://localhost:3002');

    console.log('\n=== Devnet ready ===');
    console.log('Faucet available at http://localhost:3001/faucet');
    console.log('Fee relay available at http://localhost:3002');
    console.log('\nRun "pnpm stop" to clean up.');
  } catch (error) {
    console.error('\nError occurred, cleaning up...');
    await cluster.remove().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error('Error:', error);
  // Unwrap Effect FiberFailure / TaggedError chain to find the actual Docker error
  let e: unknown = error;
  let depth = 0;
  while (e && typeof e === 'object' && 'cause' in e && depth < 10) {
    e = (e as { cause: unknown }).cause;
    depth++;
    console.error(`\n${'  '.repeat(depth)}Cause [${depth}]:`, e);
  }
  process.exit(1);
});
