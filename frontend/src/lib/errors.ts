import {BaseError} from "viem";

/** Prefers viem's decoded revert reason over raw RPC/provider error noise. */
export function extractErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof BaseError) {
    return error.shortMessage || error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
