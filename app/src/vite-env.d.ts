/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ID?: string;
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_NEAR_NETWORK_ID?: "testnet" | "mainnet";
}
