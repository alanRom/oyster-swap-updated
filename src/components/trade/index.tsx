import { Button, Spin } from "antd";
import { useState } from "react";
import {
  useConnectionConfig,
  useSlippageConfig,
} from "../../utils/solana-wallet";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { CurrencyInput } from "../currencyInput";
import { LoadingOutlined } from "@ant-design/icons";
import { swap, usePoolForBasket } from "../../utils/pools";
import { notify } from "../../utils/notifications";
import { useCurrencyPairState } from "../../utils/currencyPair";
import { generateActionLabel, POOL_NOT_AVAILABLE, SWAP_LABEL } from "../labels";
import "./trade.less";
import { getTokenName } from "../../utils/utils";

const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />;

// TODO:
// Compute price breakdown with/without fee
// Show slippage
// Show fee information

export const TradeEntry = () => {
  const walletContext = useWallet()
  const { wallet, connected, connect } = walletContext;
  const {connection} = useConnection();
  const [pendingTx, setPendingTx] = useState(false);
  const { A, B, setLastTypedAccount } = useCurrencyPairState();
  const pool = usePoolForBasket([A?.mintAddress, B?.mintAddress]);
  const { slippage } = useSlippageConfig();
  const { env } = useConnectionConfig();

  const swapAccounts = () => {
    const tempMint = A.mintAddress;
    const tempAmount = A.amount;
    A.setMint(B.mintAddress);
    A.setAmount(B.amount);
    B.setMint(tempMint);
    B.setAmount(tempAmount);
  };

  const handleSwap = async () => {
    if (A.account && B.mintAddress) {
      try {
        setPendingTx(true);

        const components = [
          {
            account: A.account,
            mintAddress: A.mintAddress,
            amount: A.convertAmount(),
          },
          {
            mintAddress: B.mintAddress,
            amount: B.convertAmount(),
          },
        ];


        await swap(connection, wallet!, walletContext, components, slippage, pool);
      } catch (e){
        console.error(e);
        notify({
          description:
            "Please try again and approve transactions from your wallet",
          message: "Swap trade cancelled.",
          type: "error",
        });
      } finally {
        setPendingTx(false);
      }
    }
  };

  return (
    <>
      <div>
        <CurrencyInput
          title="Input"
          onInputChange={(val: number) => {
            if (parseFloat(A.amount) !== val) {
              setLastTypedAccount(A.mintAddress);
            }

            A.setAmount(val.toString());
          }}
          amount={A.amount}
          mint={A.mintAddress}
          onMintChange={(item) => {
            A.setMint(item);
          }}
        />
        <Button type="primary" className="swap-button" onClick={swapAccounts}>
          ⇅
        </Button>
        <CurrencyInput
          title="To (Estimate)"
          onInputChange={(val: number) => {
            if (parseFloat(B.amount) !== val) {
              setLastTypedAccount(B.mintAddress);
            }

            B.setAmount(val.toString());
          }}
          amount={B.amount}
          mint={B.mintAddress}
          onMintChange={(item) => {
            B.setMint(item);
          }}
        />
      </div>
      <Button
        className="trade-button"
        type="primary"
        size="large"
        onClick={connected ? handleSwap : connect}
        style={{ width: "100%" }}
        disabled={
          connected &&
          (pendingTx ||
            !A.account ||
            !B.mintAddress ||
            A.account === B.account ||
            !A.sufficientBalance() ||
            !pool)
        }
      >
        {generateActionLabel(
          !pool
            ? POOL_NOT_AVAILABLE(
                getTokenName(env, A.mintAddress),
                getTokenName(env, B.mintAddress)
              )
            : SWAP_LABEL,
          connected,
          env,
          A,
          B,
          true
        )}
        {pendingTx && <Spin indicator={antIcon} className="trade-spinner" />}
      </Button>
    </>
  );
};
