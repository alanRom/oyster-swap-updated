import { AccountInfo, PublicKey } from "@solana/web3.js";

// import { TokenAccountInfo } from "@solana/spl-token";

export interface TokenAccount {
  pubkey: PublicKey;
  account: AccountInfo<Buffer>;
  info: any;
}
