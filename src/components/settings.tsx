import React, { useContext, useEffect, useState } from "react";
import { Button, Select } from "antd";
import { useConnection } from "@solana/wallet-adapter-react";
import { NumericInput } from "./numericInput";
import { AppConfigurationContext, WALLET_ENDPOINTS} from "../utils/solana-wallet";

const Slippage = () => {
  const { slippage, setSlippage } = useContext(AppConfigurationContext);
  const slippagePct = slippage * 100;
  const [value, setValue] = useState(slippagePct.toString());

  useEffect(() => {
    setValue(slippagePct.toString());
  }, [slippage, slippagePct]);

  const isSelected = (val: number) => {
    return val === slippagePct ? "primary" : "default";
  };

  const itemStyle: React.CSSProperties = {
    margin: 5,
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "row", alignItems: "center" }}
    >
      {[0.1, 0.5, 1.0].map((item) => {
        return (
          <Button
            key={item.toString()}
            style={itemStyle}
            type={isSelected(item)}
            onClick={() => setSlippage(item / 100.0)}
          >
            {item}%
          </Button>
        );
      })}
      <div style={{ padding: "3px 10px 3px 3px", border: "1px solid #434343" }}>
        <NumericInput
          className="slippage-input"
          size="small"
          placeholder={value}
          value={value}
          style={{
            width: 50,
            fontSize: 14,
            boxShadow: "none",
            borderColor: "transparent",
            outline: "transpaernt",
          }}
          onChange={(x: string) => {
            setValue(x);
            const newValue = parseFloat(x) / 100.0;
            if (Number.isFinite(newValue)) {
              setSlippage(newValue);
            }
          }}
        />
        %
      </div>
    </div>
  );
};

export const Settings = (props: {setNetwork: (network: string) => void}) => {
  // const { providerUrl, setProvider } = useWallet();
  const {connection} = useConnection();
  const providerUrl = connection.rpcEndpoint;
  const {setNetwork} = props;
  // function setProvider(value: unknown, option: DefaultOptionType ): void {
  //   throw new Error("Function not implemented.");
  // }

  return (
    <>
      <div>
        Transactions: Settings:
        <div>
          Slippage:
          <Slippage />
        </div>
      </div>
      <div style={{ display: "grid" }}>
        Network:{" "}
        <Select
          onSelect={setNetwork}
          value={providerUrl}
          style={{ marginRight: 8 }}
        >
          {WALLET_ENDPOINTS.map(({ name, endpoint }) => (
            <Select.Option displayName={name.valueOf()} key={endpoint} value={endpoint} >
              {name}
            </Select.Option>
          ))}
        </Select>
      </div>
      {/* <div style={{ display: "grid" }}>
        Wallet:{" "}
        <Select onSelect={setProvider} value={providerUrl}>
          {WALLET_PROVIDERS.map(({ name, url }) => (
            <Select.Option value={url} key={url}>
              {name}
            </Select.Option>
          ))}
        </Select>
      </div> */}
    </>
  );
};
