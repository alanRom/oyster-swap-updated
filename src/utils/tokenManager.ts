import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ENV } from "./connection";
import { WalletAdapterLocalNetwork, WalletNetwork } from "./solana-wallet";
import PopularTokens from "./token-list-new.json";
import { createAccount, createMint, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SWAP_HOST_FEE_ADDRESS, TEST_USER_LOCAL_WALLET } from "./ids";
import { newAccountWithLamports } from "./new-account-with-lamports";

export interface PopularTokenDetails {
    tokenSymbol: string;
    mintAddress: string;
    tokenName: string;
    icon: string;
}

export async function makeTokenAndFill(connection: Connection, amount = 1000n ,  tokenProgramID = TOKEN_PROGRAM_ID){
    const temptAccount = await newAccountWithLamports(connection);
    const mintAuthority =  SWAP_HOST_FEE_ADDRESS ?? new PublicKey('')
    const mintA = await createMint(
        connection,
        temptAccount,
        mintAuthority,
        null,
        2,
        Keypair.generate(),
        undefined,
        tokenProgramID,
    );
    
    const tokenAccountA = await createAccount(
        connection,
        temptAccount,
        mintA,
        TEST_USER_LOCAL_WALLET,
        Keypair.generate(),
    );
    await mintTo(
        connection,
        temptAccount,
        mintA,
        tokenAccountA,
        mintAuthority,
        amount,
    );

    return {Mint: mintA, TokenAccount: tokenAccountA}
}

async function  makeNewTestTokens(connection: Connection){
    const newTokens: PopularTokenDetails[] = [];

    for(let i =0; i < 3; i++){
        const newTok = await makeTokenAndFill(connection); 
        const symbol = newTok.Mint.toString().slice(0,3).toUpperCase();
        newTokens.push({
            tokenSymbol: symbol,
            tokenName: symbol,
            icon: '',
            mintAddress: newTok.Mint.toString()
        })
    }

    return newTokens;
}

export async function getTokensFromNetwork(network: WalletNetwork, connection?: Connection){
    const networkEnv = network.valueOf() as ENV;
    const popularTokens = PopularTokens[networkEnv] as PopularTokenDetails[];

    if(network === WalletAdapterLocalNetwork.Localnet && connection !== undefined){
        const newTokens = await makeNewTestTokens(connection);
        popularTokens.push(...newTokens)
    }
    return popularTokens;
}