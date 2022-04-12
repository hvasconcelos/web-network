import { Network, Web3Connection } from "bepro-js";
import getConfig from "next/config";

const { publicRuntimeConfig } = getConfig()

export default function networkBeproJs({
  web3Connection = publicRuntimeConfig.web3ProviderConnection,
  privateKey = process.env.NEXT_PRIVATE_KEY,
  contractAddress = publicRuntimeConfig.contract.address,
  debug = false
}: {
  web3Connection?: string;
  privateKey?: string;
  contractAddress?: string;
  debug?: boolean;
}) {
  const bepro = new Web3Connection({
    web3Host: web3Connection,
    privateKey,
    debug
  });

  return new Network(bepro, contractAddress);
}
