import { useWallet } from "@solana/wallet-adapter-react";
import { shortenAddress } from "./../utils/utils";
import { Identicon } from "./identicon";
import { useNativeAccount } from "./../utils/accounts";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export const AccountInfo = () => {
  const { wallet, publicKey } = useWallet();
  const { account } = useNativeAccount();

  if (!wallet || !publicKey) {
    return null;
  }

  return (
    <div className="wallet-wrapper">
      <span>
        {((account?.lamports || 0) / LAMPORTS_PER_SOL).toFixed(6)} SOL
      </span>
      <div className="wallet-key">
        {shortenAddress(`${publicKey}`)}
        <Identicon
          address={publicKey.toBase58()}
          style={{ marginLeft: "0.5rem" }}
        />
      </div>
    </div>
  );
};
