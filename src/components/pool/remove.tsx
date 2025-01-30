import  { useState } from "react";
import { Button } from "antd";

import { removeLiquidity } from "../../utils/pools";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PoolInfo, TokenAccount } from "../../models";
import { notify } from "../../utils/notifications";

export const RemoveLiquidity = (props: {
  instance: { account: TokenAccount; pool: PoolInfo };
}) => {
  const { account, pool } = props.instance;
  const [pendingTx, setPendingTx] = useState(false);
  const walletContext = useWallet();
  const { wallet } = walletContext;
  const {connection} = useConnection();

  const onRemove = async () => {
    try {
      setPendingTx(true);
      // TODO: calculate percentage based on user input
      const liquidityAmount = account.info.amount.toNumber();
      if(wallet){
        await removeLiquidity(connection, wallet, walletContext, liquidityAmount, account, pool);
      }
    } catch {
      notify({
        description:
          "Please try again and approve transactions from your wallet",
        message: "Removing liquidity cancelled.",
        type: "error",
      });
    } finally {
      setPendingTx(false);
      // TODO: force refresh of pool accounts?
    }
  };

  return (
    <>
      <Button type="default" onClick={onRemove} disabled={pendingTx}>
        Remove
      </Button>
    </>
  );
};
