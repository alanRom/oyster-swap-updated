import { useCallback, useState } from "react";
import { getMint, Mint } from "@solana/spl-token";
import PopularTokens from './token-list-new.json';
import { ENV } from "./connection";
import { PoolInfo, TokenAccount } from "./../models";
import { Connection, PublicKey } from "@solana/web3.js";

export interface KnownToken {
  tokenSymbol: string;
  tokenName: string;
  icon: string;
  mintAddress: string;
}

const AddressToToken = Object.keys(PopularTokens).reduce((map, key) => {
  const tokens = PopularTokens[key as ENV] as KnownToken[];
  const knownMints = tokens.reduce((map, item) => {
    map.set(item.mintAddress, item);
    return map;
  }, new Map<string, KnownToken>());

  map.set(key as ENV, knownMints);

  return map;
}, new Map<ENV, Map<string, KnownToken>>());

export function useLocalStorageState(key: string, defaultState?: string) {
  const [state, setState] = useState(() => {
    // NOTE: Not sure if this is ok
    const storedState = localStorage.getItem(key);
    if (storedState) {
      return JSON.parse(storedState);
    }
    return defaultState;
  });

  const setLocalStorageState = useCallback(
    (newState: null) => {
      const changed = state !== newState;
      if (!changed) {
        return;
      }
      setState(newState);
      if (newState === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newState));
      }
    },
    [state, key]
  );

  return [state, setLocalStorageState];
}

// shorten the checksummed version of the input address to have 0x + 4 characters at start and end
export function shortenAddress(address: string, chars = 4): string {
  return `0x${address.substring(0, chars)}...${address.substring(44 - chars)}`;
}

export function getTokenName(env: ENV, mintAddress: string): string {
  const knownSymbol = AddressToToken.get(env)?.get(mintAddress)?.tokenSymbol;
  if (knownSymbol) {
    return knownSymbol;
  }

  return shortenAddress(mintAddress).substring(10).toUpperCase();
}

export function getTokenIcon(
  env: ENV,
  mintAddress: string
): string | undefined {
  return AddressToToken.get(env)?.get(mintAddress)?.icon;
}

export function getPoolName(env: ENV, pool: PoolInfo) {
  const sorted = pool.pubkeys.holdingMints.map((a) => a.toBase58()).sort();
  return sorted.map((item) => getTokenName(env, item)).join("/");
}

export function isKnownMint(env: ENV, mintAddress: string) {
  return !!AddressToToken.get(env)?.get(mintAddress);
}

export async function isValidMint(connection: Connection, mint: PublicKey){
  try{  
    const mintInfo = await getMint(connection, mint);
    const _x = mintInfo.supply;
    return true;
  }
  catch{
    return false
  }
}

export function convert(
  account?: TokenAccount,
  mint?: Mint,
  rate: number = 1.0
): number {
  if (!account || account.info.amount === undefined) {
    return 0;
  }

  const precision = Math.pow(10, mint?.decimals || 0);
  return bigintToNumber((numberToBigint(account.info.amount) / numberToBigint(precision)) * numberToBigint(rate));
}

export function formatTokenAmount(
  account?: TokenAccount,
  mint?: Mint,
  rate: number = 1.0,
  prefix = "",
  suffix = ""
): string {
  if (!account) {
    return "";
  }

  return `${[prefix]}${convert(account, mint, rate).toFixed(6)}${suffix}`;
}

export function bigintToNumber(num: number | bigint){
  if(typeof num == 'number'){
    return num;
  }
  return Number(num);
}

export function numberToBigint(num: number | bigint)
{
  if(typeof num == 'bigint'){
    return num;
  }
  return BigInt(num).valueOf();
}

export function getMatchingTypes(num1: bigint|number, num2: bigint|number){

}
