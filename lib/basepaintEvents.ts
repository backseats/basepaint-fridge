import basepaintAbi from "../basepaint.abi.json";
import {
  createPublicClient,
  http,
  type AbiEvent,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

export interface PaintedEventSnapshot {
  day: string;
  tokenId: string;
  author: Address;
  pixels: string;
  blockNumber: string;
  transactionHash: Hex;
  logIndex: number;
}

type PaintedLogArgs = {
  day?: bigint;
  tokenId?: bigint;
  author?: Address;
  pixels?: Hex;
};

const BASEPAINT_CONTRACT_ADDRESS =
  "0xba5e05cb26b78eda3a2f8e3b3814726305dcac83" as Address;
const DEFAULT_BASE_RPC_URL =
  "https://base-mainnet.g.alchemy.com/v2/JofQHXxlqWluH_MXtwASHQ-mh_ENOQKd";

const paintedEvent = basepaintAbi.find(
  (item) => item.type === "event" && item.name === "Painted",
) as AbiEvent | undefined;

if (!paintedEvent) {
  throw new Error("Painted event not found in basepaint.abi.json");
}

function baseRpcUrl() {
  return process.env.BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL;
}

export function parsePaintDay(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error("Day must be a positive integer");
  }

  const day = BigInt(value);
  if (day <= 0n) {
    throw new Error("Day must be greater than 0");
  }

  return day;
}

export async function fetchPaintedEventsForDay(
  day: bigint,
): Promise<PaintedEventSnapshot[]> {
  const client = createPublicClient({
    chain: base,
    transport: http(baseRpcUrl()),
  });

  const logs = await client.getLogs({
    address: BASEPAINT_CONTRACT_ADDRESS,
    event: paintedEvent,
    args: {
      day,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });

  return logs.map((log) => {
    const args = "args" in log ? (log.args as PaintedLogArgs) : undefined;

    if (
      args === undefined ||
      args.day === undefined ||
      args.tokenId === undefined ||
      args.author === undefined ||
      args.pixels === undefined ||
      log.blockNumber === null
    ) {
      throw new Error(`Malformed Painted log: ${log.transactionHash}`);
    }

    return {
      day: args.day.toString(),
      tokenId: args.tokenId.toString(),
      author: args.author,
      pixels: args.pixels.slice(2),
      blockNumber: log.blockNumber.toString(),
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    };
  });
}
