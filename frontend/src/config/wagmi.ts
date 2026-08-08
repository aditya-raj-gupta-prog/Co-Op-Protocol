import {getDefaultConfig} from "@rainbow-me/rainbowkit";
import {arbitrumSepolia, baseSepolia, foundry, sepolia} from "wagmi/chains";

/**
 * "Anvil Local" is `foundry` from viem/wagmi — chain id 31337, matching
 * Foundry's default anvil genesis (http://127.0.0.1:8545).
 */
export const anvilLocal = {
  ...foundry,
  name: "Anvil Local",
};

export const supportedChains = [anvilLocal, sepolia, baseSepolia, arbitrumSepolia] as const;

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

if (!walletConnectProjectId && process.env.NODE_ENV !== "test") {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — WalletConnect-based connectors will be unavailable. " +
      "Get a project id from https://cloud.walletconnect.com and add it to .env.local."
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "Co-Op Protocol",
  projectId: walletConnectProjectId || "00000000000000000000000000000000",
  chains: supportedChains,
  ssr: true,
});

export type SupportedChainId = (typeof supportedChains)[number]["id"];
