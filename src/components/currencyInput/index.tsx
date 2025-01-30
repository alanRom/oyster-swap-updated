import { Card, Select } from "antd";
import { NumericInput } from "../numericInput";
import {
  bigintToNumber,
  numberToBigint,
  getPoolName,
  getTokenName,
  isKnownMint,
  KnownToken,
} from "../../utils/utils";
import { useUserAccounts, useMint, useCachedPool } from "../../utils/accounts";
import "./styles.less";
import { ENV } from "../../utils/connection";
import { PoolIcon, TokenIcon } from "../tokenIcon";
import PopularTokens from "../../utils/token-list-new.json";
import { PublicKey } from "@solana/web3.js";
import { PoolInfo, TokenAccount } from "../../models";
import { useAppConfig } from "../../utils/solana-wallet";
// import { useConnection } from "@solana/wallet-adapter-react";
// import { getNetworkFromEndpoint, useAppConfig } from "../../utils/solana-wallet";
// import {getTokensFromNetwork} from '../../utils/tokenManager';

const { Option } = Select;

export const CurrencyInput = (props: {
  mint?: string;
  amount?: string;
  title?: string;
  onInputChange?: (val: number) => void;
  onMintChange?: (account: string) => void;
}) => {
  const { userAccounts } = useUserAccounts();
  const { pools } = useCachedPool();
  const mint = useMint(props.mint);

  // const { connection } = useConnection();
  const {network} = useAppConfig();
  const env = network.valueOf() as ENV;
  const tokens = PopularTokens[network.valueOf() as ENV] as KnownToken[];

  const renderPopularTokens = tokens.map((item) => {
    return (
      <Option
        key={item.mintAddress}
        value={item.mintAddress}
        title={item.mintAddress}
      >
        <div
          key={item.mintAddress}
          style={{ display: "flex", alignItems: "center" }}
        >
          <TokenIcon mintAddress={item.mintAddress} />
          {item.tokenSymbol}
        </div>
      </Option>
    );
  });

  // TODO: expand nested pool names ...?

  // group accounts by mint and use one with biggest balance
  const grouppedUserAccounts = userAccounts
    .sort((a, b) => {
      return bigintToNumber(numberToBigint(b.info.amount) - numberToBigint(a.info.amount));
    })
    .reduce((map, acc) => {
      const mint = acc.info.mint.toBase58();
      if (isKnownMint(env, mint)) {
        return map;
      }

      const pool = pools.find((p) => p && p.pubkeys.mint.toBase58() === mint);

      map.set(mint, (map.get(mint) || []).concat([{ account: acc, pool }]));

      return map;
    }, new Map<string, { account: TokenAccount; pool: PoolInfo | undefined }[]>());

  // TODO: group multple accounts of same time and select one with max amount
  const renderAdditionalTokens = [...grouppedUserAccounts.keys()].map(
    (mint) => {
      const list = grouppedUserAccounts.get(mint);
      if (!list || list.length <= 0) {
        return undefined;
      }

      const account = list[0];

      if (numberToBigint(account.account.info.amount) === 0n) {
        return undefined;
      }

      let name: string;
      let icon: JSX.Element;
      if (account.pool) {
        name = getPoolName(env, account.pool);

        const sorted = account.pool.pubkeys.holdingMints
          .map((a: PublicKey) => a.toBase58())
          .sort();
        icon = <PoolIcon mintA={sorted[0]} mintB={sorted[1]} />;
      } else {
        
        name = getTokenName(env, mint);
        icon = <TokenIcon mintAddress={mint} />;
      }

      return (
        <Option
          key={account.account.pubkey.toBase58()}
          value={mint}
          title={mint}
        >
          <div key={mint} style={{ display: "flex", alignItems: "center" }}>
            {icon}
            {name}
          </div>
        </Option>
      );
    }
  );

  const userUiBalance = () => {
    const currentAccount = userAccounts?.find(
      (a) => a.info.mint.toBase58() === props.mint
    );
    if (currentAccount && mint) {
      return bigintToNumber(
        numberToBigint(currentAccount.info.amount) / numberToBigint(Math.pow(10, mint.decimals))
      );
    }

    return 0;
  };

  return (
    <Card
      className="ccy-input"
      styles={{body: { padding: 0 }}}
      style={{ borderRadius: 20, margin: 15 }}
    >
      <div className="ccy-input-header">
        <div className="ccy-input-header-left">{props.title}</div>

        <div
          className="ccy-input-header-right"
          onClick={() =>
            props.onInputChange && props.onInputChange(userUiBalance())
          }
        >
          Balance: {userUiBalance().toFixed(6)}
        </div>
      </div>
      <div className="ccy-input-header" style={{ padding: "0px 10px 5px 7px" }}>
        <NumericInput
          value={props.amount}
          onChange={(val: string| number) => {
            if (props.onInputChange) {
              let numToUse;
              if( typeof val === 'number'){
                numToUse = val;
              } else {
                if(val === ''){
                  numToUse = 0;
                } else {
                  numToUse = parseFloat(val);
                }
              }
              props.onInputChange(numToUse);
            }
          }}
          style={{
            fontSize: 20,
            boxShadow: "none",
            borderColor: "transparent",
            outline: "transpaernt",
          }}
          placeholder="0.00"
        />

        <div className="ccy-input-header-right" style={{ display: "felx" }}>
          <Select
            size="large"
            style={{ minWidth: 80 }}
            placeholder="CCY"
            value={props.mint}
            popupMatchSelectWidth ={true}
            dropdownStyle={{ minWidth: 200 }}
            onChange={(item) => {
              if (props.onMintChange) {
                props.onMintChange(item);
              }
            }}
          >
            {[...renderPopularTokens, ...renderAdditionalTokens]}
          </Select>
        </div>
      </div>
    </Card>
  );
};
