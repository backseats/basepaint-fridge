import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { writeFileSync } from 'fs';
import { join } from 'path';

const client = createPublicClient({
  chain: base,
  transport: http('https://base-mainnet.g.alchemy.com/v2/JofQHXxlqWluH_MXtwASHQ-mh_ENOQKd'),
});

const CONTRACT_ADDRESS = '0xba5e05cb26b78eda3a2f8e3b3814726305dcac83';
const TARGET_DAY = 886n;

const PAINTED_EVENT_ABI = {
  anonymous: false,
  inputs: [
    {
      indexed: true,
      internalType: 'uint256',
      name: 'day',
      type: 'uint256',
    },
    {
      indexed: false,
      internalType: 'uint256',
      name: 'tokenId',
      type: 'uint256',
    },
    {
      indexed: false,
      internalType: 'address',
      name: 'author',
      type: 'address',
    },
    {
      indexed: false,
      internalType: 'bytes',
      name: 'pixels',
      type: 'bytes',
    },
  ],
  name: 'Painted',
  type: 'event',
} as const;

async function fetchPaintedEvents() {
  console.log(`Fetching Painted events for day ${TARGET_DAY}...`);

  const logs = await client.getLogs({
    address: CONTRACT_ADDRESS,
    event: parseAbiItem('event Painted(uint256 indexed day, uint256 tokenId, address author, bytes pixels)'),
    args: {
      day: TARGET_DAY,
    },
    fromBlock: 0n,
    toBlock: 'latest',
  });

  console.log(`Found ${logs.length} events`);

  const events = logs.map((log) => ({
    day: log.args.day?.toString(),
    tokenId: log.args.tokenId?.toString(),
    author: log.args.author,
    pixels: log.args.pixels?.slice(2), // Remove 0x prefix
    blockNumber: log.blockNumber.toString(),
    transactionHash: log.transactionHash,
  }));

  const outputPath = join(process.cwd(), 'painted-events-day-886.json');
  writeFileSync(outputPath, JSON.stringify(events, null, 2));

  console.log(`Saved ${events.length} events to ${outputPath}`);
  console.log('\nSample event:');
  console.log(JSON.stringify(events[0], null, 2));
}

fetchPaintedEvents().catch(console.error);
