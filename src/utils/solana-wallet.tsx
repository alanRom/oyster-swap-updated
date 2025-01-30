/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {  useMemo, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { UnsafeBurnerWalletAdapter, MathWalletAdapter, SolflareWalletAdapter, CoinbaseWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-ant-design';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-ant-design/styles.css';
import { setProgramIds } from './ids';

import { createContext, useContext } from 'react';
import Popover from 'antd/es/popover';
import { Settings } from '../components/settings';
import Button from 'antd/es/button';
import { SettingOutlined } from "@ant-design/icons";
import { ConfigProvider, theme } from 'antd';
import { ENV } from './connection';
import { useLocalStorageState } from './utils';

export interface NetworkContextState {
    network: WalletAdapterNetwork;
    endpoint: string;
}

export enum WalletAdapterLocalNetwork {
    Localnet = 'localnet'
}

export type WalletNetwork = WalletAdapterNetwork | WalletAdapterLocalNetwork;

export const NetworkContext = createContext<NetworkContextState>({} as NetworkContextState);

export function useNetwork(): NetworkContextState {
    return useContext(NetworkContext);
}

// function getNetworkFromEnv(envString: ENV) {
//     let endpoint ;
//     switch(envString){
//         case 'mainnet-beta':
//             endpoint = WalletAdapterNetwork.Mainnet;
//             break; 
//         case 'devnet':
//             endpoint = WalletAdapterNetwork.Devnet;
//             break;
//         case 'testnet':
//             endpoint = WalletAdapterNetwork.Testnet;
//             break
//         case 'localnet':
//             endpoint = WalletAdapterLocalNetwork.Localnet    
//             break;
//     }
//     return endpoint;
// }

export function getNetworkFromEndpoint(endpoint: string): WalletNetwork{
    let network ;
    for(const walletEndpoint of WALLET_ENDPOINTS){
        if(walletEndpoint.endpoint === endpoint){
            network = walletEndpoint.name
        }
    }
    if(!network){
        throw new Error('Wallet Network Not Found')
    }
    return network;
}


export function getEndpointFromNetwork(network: WalletNetwork) {
    let endpoint ;
    switch(network){
        case WalletAdapterNetwork.Mainnet: 
        case WalletAdapterNetwork.Devnet:
        case WalletAdapterNetwork.Testnet:
            endpoint = clusterApiUrl(network);
            break;
        case WalletAdapterLocalNetwork.Localnet:
            endpoint = "http://127.0.0.1:8899";
            break;
    }
    return endpoint
}

export const WALLET_ENDPOINTS = [
        { name: WalletAdapterNetwork.Mainnet, endpoint: getEndpointFromNetwork(WalletAdapterNetwork.Mainnet) },
        { name:  WalletAdapterNetwork.Testnet, endpoint: getEndpointFromNetwork(WalletAdapterNetwork.Testnet) },
        { name: WalletAdapterNetwork.Devnet, endpoint: getEndpointFromNetwork(WalletAdapterNetwork.Devnet) },
        { name: WalletAdapterLocalNetwork.Localnet, endpoint: getEndpointFromNetwork(WalletAdapterLocalNetwork.Localnet) },
];

const DEFAULT_NETWORK = WalletAdapterNetwork.Devnet;
const DEFAULT_SLIPPAGE = 0.25;

interface AppConnectionConfig {
    network: WalletNetwork;
    endpoint: string;
    slippage: number;
    setSlippage: (val: number) => void;
    // env: ENV;
    setEndpoint: (val: string) => void;
}

export const AppConfigurationContext = createContext<AppConnectionConfig>({
    network: DEFAULT_NETWORK,
    endpoint: getEndpointFromNetwork(DEFAULT_NETWORK),
    slippage: DEFAULT_SLIPPAGE,
    setEndpoint: () => {},
    // env: 
    setSlippage: (_val: number) => {},
})

export const useAppConfig = () =>{
    return useContext(AppConfigurationContext)
}

export function useSlippageConfig() {
    const { slippage, setSlippage } = useContext(AppConfigurationContext);
    return { slippage, setSlippage };
}


export function useConnectionConfig() {
    const context = useContext(AppConfigurationContext);
    return {
      endpoint: context.endpoint,
      setEndpoint: context.setEndpoint,
      env: context.network.valueOf() as ENV,
    };
  }

export const SolanaWalletProvider = ({children}: React.PropsWithChildren) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const [network, setNetwork] = useState(DEFAULT_NETWORK);
    // const [endpoint, setEndpoint] = useState(getEndpointFromNetwork(network));
    // const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
    const [endpoint, setEndpoint] = useLocalStorageState(
        "connectionEndpts",
        getEndpointFromNetwork(network)
    );

    const [slippage, setSlippage] = useLocalStorageState(
    "slippage",
    DEFAULT_SLIPPAGE.toString()
    );
    

    // You can also provide a custom RPC endpoint.
    // const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    
    // const env =
    // ENDPOINTS.find((end) => end.endpoint === endpoint)?.name ||
    // ENDPOINTS[0].name;

    setProgramIds(network.valueOf());

    const changeNetwork = (env: string) => {
        const network = getNetworkFromEndpoint(env);
        setNetwork(network);
        const newEndpoint = getEndpointFromNetwork(network)
        setEndpoint(newEndpoint);

        setProgramIds(network.valueOf());
    }

    const wallets = useMemo(
        () => [
            new SolflareWalletAdapter(),
            new MathWalletAdapter(),
            new CoinbaseWalletAdapter(),
            
            /**
             * Wallets that implement either of these standards will be available automatically.
             *
             *   - Solana Mobile Stack Mobile Wallet Adapter Protocol
             *     (https://github.com/solana-mobile/mobile-wallet-adapter)
             *   - Solana Wallet Standard
             *     (https://github.com/anza-xyz/wallet-standard)
             *
             * If you wish to support a wallet that supports neither of those standards,
             * instantiate its legacy wallet adapter here. Common legacy adapters can be found
             * in the npm package `@solana/wallet-adapter-wallets`.
             */
            new UnsafeBurnerWalletAdapter(),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [network]
    );

    return (
        <AppConfigurationContext.Provider value={{
            endpoint,
            setEndpoint,
            slippage: slippage,
            setSlippage: (val) => setSlippage(val),
            network: network
        }}>
            <ConnectionProvider endpoint={endpoint}>
            <ConfigProvider
                theme={{
                    algorithm: theme.defaultAlgorithm,
                }}
            >
                <WalletProvider wallets={wallets} autoConnect>
                    <WalletModalProvider>
                        <WalletMultiButton />
                        <WalletDisconnectButton />
                        {
                        <Popover
                            placement="topRight"
                            title="Settings"
                            content={<Settings setNetwork={changeNetwork}/>}
                            trigger="click"
                        >
                            <Button
                            shape="circle"
                            size="large"
                            type="text"
                            icon={<SettingOutlined />}
                            />
                        </Popover>
                        }
                        {children}
                    </WalletModalProvider>
                </WalletProvider>
            </ConfigProvider>
            </ConnectionProvider>
        </AppConfigurationContext.Provider>
    );
};