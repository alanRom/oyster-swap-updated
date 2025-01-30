/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { sendTransaction } from "./connection";
import { useEffect, useState } from "react";
import { createInitializeAccountInstruction, createInitializeMintInstruction, createApproveInstruction, MintLayout, AccountLayout, createCloseAccountInstruction, createTransferInstruction } from "@solana/spl-token";
import { notify } from "./notifications"; 
import {
  cache,
  getCachedAccount,
  useUserAccounts,
  useCachedPool,
} from "./accounts";
import {
  programIds,
  SWAP_HOST_FEE_ADDRESS,
  SWAP_PROGRAM_OWNER_FEE_ADDRESS,
  WRAPPED_SOL_MINT,
} from "./ids";
import {
  LiquidityComponent,
  PoolInfo,
  TokenAccount,
  TokenSwapLayoutLegacyV0,
  PoolConfig,
  swapInstruction,
} from "./../models";
import {
  TokenSwap, TokenSwapLayout
} from '@solana/spl-token-swap';
import { Wallet, WalletContextState, useConnection } from "@solana/wallet-adapter-react";
import { bigintToNumber, numberToBigint } from "./utils";


const HOST_FEE_NUMERATOR = 20n;
const HOST_FEE_DENOMINATOR = 100n;
const LIQUIDITY_TOKEN_PRECISION = 8;

export const removeLiquidity = async (
  connection: Connection,
  wallet: Wallet,
  walletContext: WalletContextState,
  liquidityAmount: number,
  account: TokenAccount,
  pool?: PoolInfo
) => {
  if (!pool || !wallet?.adapter.publicKey) {
    return;
  }

  notify({
    message: "Removing Liquidity...",
    description: "Please review transactions to approve.",
    type: "warning",
  });

  // TODO get min amounts based on total supply and liquidity
  const minAmount0 = 0;
  const minAmount1 = 0;

  const poolMint = await cache.getMint(connection, pool.pubkeys.mint);
  const accountA = await cache.getAccount(
    connection,
    pool.pubkeys.holdingAccounts[0]
  );
  const accountB = await cache.getAccount(
    connection,
    pool.pubkeys.holdingAccounts[1]
  );
  if (!poolMint.mintAuthority) {
    throw new Error("Mint doesnt have authority");
  }
  const authority = poolMint.mintAuthority;

  const signers: Keypair[] = [];
  const instructions: TransactionInstruction[] = [];
  const cleanupInstructions: TransactionInstruction[] = [];

  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span
  );

  // TODO: check if one of to accounts needs to be native sol ... if yes unwrap it ...
  const toAccounts: PublicKey[] = [
    await findOrCreateAccountByMint(
      wallet.adapter.publicKey,
      wallet.adapter.publicKey,
      instructions,
      cleanupInstructions,
      accountRentExempt,
      accountA.info.mint,
      signers
    ),
    await findOrCreateAccountByMint(
      wallet.adapter.publicKey,
      wallet.adapter.publicKey,
      instructions,
      cleanupInstructions,
      accountRentExempt,
      accountB.info.mint,
      signers
    ),
  ];

  instructions.push(
    createApproveInstruction(
      account.pubkey,
      authority,
      wallet.adapter.publicKey,
      liquidityAmount,
      [],
      programIds().token,
    )
  );

  // withdraw
  instructions.push(
    TokenSwap.withdrawAllTokenTypesInstruction(
      pool.pubkeys.account,
      authority,
      wallet.adapter.publicKey, //maybe?
      pool.pubkeys.mint,
      pool.pubkeys.feeAccount!,
      account.pubkey,
      pool.pubkeys.holdingAccounts[0],
      pool.pubkeys.holdingAccounts[1],
      toAccounts[0],
      toAccounts[1],
      pool.pubkeys.holdingMints[0], //maybe?
      pool.pubkeys.holdingMints[1], //maybe?
      pool.pubkeys.program,
      programIds().token,
      programIds().token,
      programIds().token,
      numberToBigint(liquidityAmount),
      numberToBigint(minAmount0),
      numberToBigint(minAmount1)
    )
  );

  // const transaction = new Transaction().add(...instructions.concat(cleanupInstructions))

  const tx = await sendTransaction(
    // const tx = await connection.sendTransaction(
    connection,
    wallet,
    walletContext,
    instructions.concat(cleanupInstructions),
    signers
  );

  notify({
    message: "Liquidity Returned. Thank you for your support.",
    type: "success",
    description: `Transaction - ${tx}`,
  });
};

export const swap = async (
  connection: Connection,
  wallet: Wallet,
  walletContext: WalletContextState,
  components: LiquidityComponent[],
  SLIPPAGE: number,
  pool?: PoolInfo
) => {
  const walletKey = wallet.adapter.publicKey;
  if (!walletKey || !pool || !components[0].account) {
    notify({
      type: "error",
      message: `Pool doesn't exsist.`,
      description: `Swap trade cancelled`,
    });
    return;
  }

  // Uniswap whitepaper: https://uniswap.org/whitepaper.pdf
  // see: https://uniswap.org/docs/v2/advanced-topics/pricing/
  // as well as native uniswap v2 oracle: https://uniswap.org/docs/v2/core-concepts/oracles/
  const amountIn = components[0].amount; // these two should include slippage
  const minAmountOut = components[1].amount * (1 - SLIPPAGE);
  
  const holdingAIndex = pool.pubkeys.holdingMints[0].toBase58() ===
  components[0].account.info.mint.toBase58() 
  ? 0
  : 1;

  const holdingBIndex = holdingAIndex == 0 ? 1 : 0;
  
  const holdingA = pool.pubkeys.holdingAccounts[holdingAIndex];
  const holdingB = pool.pubkeys.holdingAccounts[holdingBIndex];
    
  const holdingMintA = pool.pubkeys.holdingMints[holdingAIndex];
  const holdingMintB = pool.pubkeys.holdingMints[holdingBIndex];
      
  // const holdingB =
  //   holdingA === pool.pubkeys.holdingAccounts[0]
  //     ? pool.pubkeys.holdingAccounts[1]
  //     : pool.pubkeys.holdingAccounts[0];

//   const holdingMintA =
//       pool.pubkeys.holdingMints[0].toBase58() ===
//       components[0].account.info.mint.toBase58()
//         ? pool.pubkeys.holdingMints[0]
//         : pool.pubkeys.holdingMints[1];
// const holdingMintB =
//       holdingA === pool.pubkeys.holdingAccounts[0]
//         ? pool.pubkeys.holdingMints[1]
//         : pool.pubkeys.holdingMints[0];


    // const mintAAccount = await cache.getAccount(
    //   connection,
    //   holdingMintA
    // );
    // const mintBAccount = await cache.getAccount(
    //   connection,
    //   holdingMintB
    // );

  const poolMint = await cache.getMint(connection, pool.pubkeys.mint);
  if (!poolMint.mintAuthority || !pool.pubkeys.feeAccount) {
    throw new Error("Mint doesnt have authority");
  }
  const authority = poolMint.mintAuthority;

  const instructions: TransactionInstruction[] = [];
  const cleanupInstructions: TransactionInstruction[] = [];
  const signers: Keypair[] = [];

  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span
  );

  const fromAccount = getWrappedAccount(
    instructions,
    cleanupInstructions,
    components[0].account,
    walletKey,
    amountIn + accountRentExempt,
    signers
  );

  const toAccount = findOrCreateAccountByMint(
    walletKey,
    walletKey,
    instructions,
    cleanupInstructions,
    accountRentExempt,
    new PublicKey(components[1].mintAddress),
    signers
  );

  // create approval for transfer transactions
  instructions.push(
    createApproveInstruction(
      fromAccount,
      authority,
      walletKey,
      amountIn,
      [],
      programIds().token,
    )
  );

  const hostFeeAccount = SWAP_HOST_FEE_ADDRESS
    ? findOrCreateAccountByMint(
      walletKey,
        SWAP_HOST_FEE_ADDRESS,
        instructions,
        cleanupInstructions,
        accountRentExempt,
        pool.pubkeys.mint,
        signers
      )
    : undefined;

  // swap
  // console.log({
  //   tokenSwap: pool.pubkeys.account.toString(),
  //   authority: authority.toString(),
  //   userTransferAuthority: walletKey.toString(), //TODO: maybe is userTransferAuthority?
  //   userSource: fromAccount.toString(),
  //   poolSource: holdingA.toString(),
  //   poolDestination: holdingB.toString(),
  //   userDestination: toAccount.toString(),
  //   poolMint: pool.pubkeys.mint.toString(),
  //   feeAccount: pool.pubkeys.feeAccount.toString(),
  //   hostFeeAccount: hostFeeAccount ?? null,
  //   sourceMint: holdingMintA.toString(),
  //   destinationMint: holdingMintB.toString(),
  //   swapProgramId: pool.pubkeys.program.toString(),
  //   // mintAAccount.account.owner,
  //   // mintBAccount.account.owner,
  //   sourceTokenProgramId: programIds().token.toString(),
  //   destinationTokenProgramId: programIds().token.toString(),
  //   poolTokenProgramId: programIds().token.toString(),
  //   amountIn: numberToBigint(amountIn),
  //   minimumAmountOut: numberToBigint(minAmountOut),
  // })
  instructions.push(
    // swapInstruction(
    //   pool.pubkeys.account,
    //   authority,
    //   fromAccount,
    //   holdingA,
    //   holdingB,
    //   toAccount,
    //   pool.pubkeys.mint,
    //   pool.pubkeys.feeAccount,
    //   pool.pubkeys.program,
    //   programIds().token,
    //   amountIn,
    //   minAmountOut,
    //   hostFeeAccount
    // )
    TokenSwap.swapInstruction(
      pool.pubkeys.account,
      authority,
      walletKey, //TODO: maybe is userTransferAuthority?
      fromAccount,
      holdingA,
      holdingB,
      toAccount,
      pool.pubkeys.mint,
      pool.pubkeys.feeAccount,
      hostFeeAccount ?? null,
      holdingMintA,
      holdingMintB,
      pool.pubkeys.program,
      // mintAAccount.account.owner,
      // mintBAccount.account.owner,
      programIds().token,
      programIds().token,
      programIds().token,
      numberToBigint(amountIn),
      numberToBigint(minAmountOut),
    )
  );

  const tx = await sendTransaction(
    connection,
    wallet,
    walletContext,
    instructions.concat(cleanupInstructions),
    signers
  );

  notify({
    message: "Trade executed.",
    type: "success",
    description: `Transaction - ${tx}`,
  });
};

export const addLiquidity = async (
  connection: Connection,
  wallet: Wallet,
  walletContext: WalletContextState,
  components: LiquidityComponent[],
  slippage: number,
  pool?: PoolInfo,
  options?: PoolConfig
) => {
  if (!pool) {
    if (!options) {
      throw new Error("Options are required to create new pool.");
    }

    await _addLiquidityNewPool(wallet, walletContext, connection, components, options);
  } else {
    await _addLiquidityExistingPool(
      pool,
      components,
      connection,
      wallet,
      walletContext,
      slippage
    );
  }
};

const getHoldings = (connection: Connection, accounts: string[]) => {
  return accounts.map((acc) =>
    cache.getAccount(connection, new PublicKey(acc))
  );
};

const toPoolInfo = (item: any, program: PublicKey, toMerge?: PoolInfo) => {
  const mint = new PublicKey(item.data.tokenPool);
  return {
    pubkeys: {
      account: item.pubkey,
      program: program,
      mint,
      holdingMints: [] as PublicKey[],
      holdingAccounts: [item.data.tokenAccountA, item.data.tokenAccountB].map(
        (a) => new PublicKey(a)
      ),
    },
    legacy: false,
    raw: item,
  } as PoolInfo;
};

export const usePools = () => {
  const {connection} = useConnection();
  const [pools, setPools] = useState<PoolInfo[]>([]);
  // initial query
  useEffect(() => {
    setPools([]);

    const queryPools = async (swapId: PublicKey, isLegacy = false) => {
      const poolsArray: PoolInfo[] = [];
      try{
        (await connection.getProgramAccounts(swapId))
        .filter(
          (item) =>
            item.account.data.length === TokenSwapLayout.span ||
            item.account.data.length === TokenSwapLayoutLegacyV0.span
        )
        .map((item) => {
          const result = {
            data: undefined as any,
            account: item.account,
            pubkey: item.pubkey,
            init: async () => {},
          };

          // handling of legacy layout can be removed soon...
          if (item.account.data.length === TokenSwapLayoutLegacyV0.span) {
            result.data = TokenSwapLayoutLegacyV0.decode(item.account.data);
            const pool = toPoolInfo(result, swapId);
            pool.legacy = isLegacy;
            poolsArray.push(pool as PoolInfo);

            result.init = async () => {
              try {
                // TODO: this is not great
                // Ideally SwapLayout stores hash of all the mints to make finding of pool for a pair easier
                const holdings = await Promise.all(
                  getHoldings(connection, [
                    result.data.tokenAccountA,
                    result.data.tokenAccountB,
                  ])
                );

                pool.pubkeys.holdingMints = [
                  holdings[0].info.mint,
                  holdings[1].info.mint,
                ] as PublicKey[];
              } catch (err) {
                console.log(err);
              }
            };
          } else {
            result.data = TokenSwapLayout.decode(item.account.data);
            const pool = toPoolInfo(result, swapId);
            pool.legacy = isLegacy;
            pool.pubkeys.feeAccount = new PublicKey(result.data.feeAccount);
            pool.pubkeys.holdingMints = [
              new PublicKey(result.data.mintA),
              new PublicKey(result.data.mintB),
            ] as PublicKey[];

            poolsArray.push(pool as PoolInfo);
          }

          return result;
        });
      }
      catch(e){
        console.error(e)
      }
      return poolsArray;
    };

    Promise.all([
      queryPools(programIds().swap),
      ...programIds().swap_legacy.map((leg) => queryPools(leg, true)),
    ]).then((all) => {
      setPools(all.flat());
    }).catch((err) => {
      console.error(err)
    });
  }, [connection]);

  useEffect(() => {
    const subID = connection.onProgramAccountChange(
      programIds().swap,
      async (info) => {
        const id = (info.accountId as unknown) as string;
        if (info.accountInfo.data.length === TokenSwapLayout.span) {
          const account = info.accountInfo;
          const updated = {
            data: TokenSwapLayout.decode(account.data),
            account: account,
            pubkey: new PublicKey(id),
          };

          const index =
            pools &&
            pools.findIndex((p) => p.pubkeys.account.toBase58() === id);
          if (index && index >= 0 && pools) {
            // TODO: check if account is empty?

            const filtered = pools.filter((p, i) => i !== index);
            setPools([...filtered, toPoolInfo(updated, programIds().swap)]);
          } else {
            const pool = toPoolInfo(updated, programIds().swap);

            pool.pubkeys.feeAccount = new PublicKey(updated.data.feeAccount);
            pool.pubkeys.holdingMints = [
              new PublicKey(updated.data.mintA),
              new PublicKey(updated.data.mintB),
            ] as PublicKey[];

            setPools([...pools, pool]);
          }
        }
      },
      "singleGossip"
    );

    return () => {
      connection.removeProgramAccountChangeListener(subID);
    };
  }, [connection, pools]);

  return { pools };
};

export const usePoolForBasket = (mints: (string | undefined)[]) => {
  const {connection} = useConnection();
  const { pools } = useCachedPool();
  const [pool, setPool] = useState<PoolInfo>();
  const sortedMints = [...mints].sort();
  useEffect(() => {
    (async () => {
      // reset pool during query
      setPool(undefined);

      const matchingPool = pools
        .filter((p) => !p.legacy)
        .filter((p) =>
          p.pubkeys.holdingMints
            .map((a) => a.toBase58())
            .sort()
            .every((address, i) => address === sortedMints[i])
        );

      for (let i = 0; i < matchingPool.length; i++) {
        const p = matchingPool[i];

        const account = await cache.getAccount(
          connection,
          p.pubkeys.holdingAccounts[0]
        );

        if (numberToBigint(account.info.amount) !== 0n ) {
          setPool(p);
          return;
        }
      }
    })();
  }, [connection, sortedMints, pools]);

  return pool;
};

export const useOwnedPools = () => {
  const { pools } = useCachedPool();
  const { userAccounts } = useUserAccounts();

  const map = userAccounts.reduce((acc, item) => {
    const key = item.info.mint.toBase58();
    acc.set(key, [...(acc.get(key) || []), item]);
    return acc;
  }, new Map<string, TokenAccount[]>());

  return pools
    .filter((p) => map.has(p.pubkeys.mint.toBase58()))
    .map((item) => {
      const feeAccount = item.pubkeys.feeAccount?.toBase58();
      return map.get(item.pubkeys.mint.toBase58())?.map((a) => {
        return {
          account: a as TokenAccount,
          isFeeAccount: feeAccount === a.pubkey.toBase58(),
          pool: item,
        };
      });
    })
    .flat();
};

async function _addLiquidityExistingPool(
  pool: PoolInfo,
  components: LiquidityComponent[],
  connection: Connection,
  wallet: Wallet,
  walletContext: WalletContextState,
  SLIPPAGE: number
) {
  notify({
    message: "Adding Liquidity...",
    description: "Please review transactions to approve.",
    type: "warning",
  });

  const walletKey = wallet.adapter.publicKey;


  const poolMint = await cache.getMint(connection, pool.pubkeys.mint);
  if (!poolMint.mintAuthority) {
    throw new Error("Mint doesnt have authority");
  }

  if (!walletKey || !pool.pubkeys.feeAccount) {
    throw new Error("Invald fee account");
  }

  const accountA = await cache.getAccount(
    connection,
    pool.pubkeys.holdingAccounts[0]
  );
  const accountB = await cache.getAccount(
    connection,
    pool.pubkeys.holdingAccounts[1]
  );

  const mintAAccount = await cache.getAccount(
    connection,
    accountA.info.mint
  );

  const mintBAccount = await cache.getAccount(
    connection,
    accountB.info.mint
  );


  const reserve0 = bigintToNumber(accountA.info.amount);
  const reserve1 = bigintToNumber(accountB.info.amount);
  const fromA =
    accountA.info.mint.toBase58() === components[0].mintAddress
      ? components[0]
      : components[1];
  const fromB = fromA === components[0] ? components[1] : components[0];

  if (!fromA.account || !fromB.account) {
    throw new Error("Missing account info.");
  }

  const supply =  new Number(poolMint.supply).valueOf();
  const authority = poolMint.mintAuthority;

  // Uniswap whitepaper: https://uniswap.org/whitepaper.pdf
  // see: https://uniswap.org/docs/v2/advanced-topics/pricing/
  // as well as native uniswap v2 oracle: https://uniswap.org/docs/v2/core-concepts/oracles/
  const amount0 = (fromA.amount);
  const amount1 = (fromB.amount);

  const liquidity = Math.min(
    (amount0 * (1 - SLIPPAGE) * supply) / reserve0,
    (amount1 * (1 - SLIPPAGE) * supply) / reserve1
  );
  const instructions: TransactionInstruction[] = [];
  const cleanupInstructions: TransactionInstruction[] = [];

  const signers: Keypair[] = [];

  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span
  );
  const fromKeyA = getWrappedAccount(
    instructions,
    cleanupInstructions,
    fromA.account,
    walletKey,
    amount0 + accountRentExempt,
    signers
  );
  const fromKeyB = getWrappedAccount(
    instructions,
    cleanupInstructions,
    fromB.account,
    walletKey,
    amount1 + accountRentExempt,
    signers
  );

  const toAccount = findOrCreateAccountByMint(
    walletKey,
    walletKey,
    instructions,
    [],
    accountRentExempt,
    pool.pubkeys.mint,
    signers,
    new Set<string>([pool.pubkeys.feeAccount.toBase58()])
  );

  // create approval for transfer transactions
  instructions.push(
    createApproveInstruction(
      fromKeyA,
      authority,
      walletKey,
      amount0,
      [],
      programIds().token,
    )
  );

  instructions.push(
    createApproveInstruction(
      fromKeyB,
      authority,
      walletKey,
      amount1,
      [],
      programIds().token,
    )
  );

  // depoist
  instructions.push(
    TokenSwap.depositAllTokenTypesInstruction(
      pool.pubkeys.account,
      authority,
      walletKey, //TODO: Maybe is userTransferAuthority?
      fromKeyA,
      fromKeyB,
      pool.pubkeys.holdingAccounts[0],
      pool.pubkeys.holdingAccounts[1],
      pool.pubkeys.mint,
      toAccount,
      accountA.info.mint,
      accountB.info.mint,
      pool.pubkeys.program,
      programIds().token,
      mintAAccount.account.owner,
      mintBAccount.account.owner,
      numberToBigint(liquidity),
      numberToBigint(amount0),
      numberToBigint(amount1)
    )
  );

  const tx = await sendTransaction(
    connection,
    wallet,
    walletContext,
    instructions.concat(cleanupInstructions),
    signers
  );

  notify({
    message: "Pool Funded. Happy trading.",
    type: "success",
    description: `Transaction - ${tx}`,
  });
}

function findOrCreateAccountByMint(
  payer: PublicKey,
  owner: PublicKey,
  instructions: TransactionInstruction[],
  cleanupInstructions: TransactionInstruction[],
  accountRentExempt: number,
  mint: PublicKey, // use to identify same type
  signers: Keypair[],
  excluded?: Set<string>
): PublicKey {
  const accountToFind = mint.toBase58();
  const account = getCachedAccount(
    (acc) =>
      acc.info.mint.toBase58() === accountToFind &&
      acc.info.owner.toBase58() === owner.toBase58() &&
      (excluded === undefined || !excluded.has(acc.pubkey.toBase58()))
  );
  const isWrappedSol = accountToFind === WRAPPED_SOL_MINT.toBase58();

  let toAccount: PublicKey;
  if (account && !isWrappedSol) {
    toAccount = account.pubkey;
  } else {
    // creating depositor pool account
    const newToAccount = createSplAccount(
      instructions,
      payer,
      accountRentExempt,
      mint,
      owner,
      AccountLayout.span
    );

    toAccount = newToAccount.publicKey;
    signers.push(newToAccount);

    if (isWrappedSol) {
      cleanupInstructions.push(
        createCloseAccountInstruction(
          toAccount,
          payer,
          payer,
          [],
          programIds().token,
        )
      );
    }
  }

  return toAccount;
}

export async function calculateDependentAmount(
  connection: Connection,
  independent: string,
  amount: number,
  pool: PoolInfo
): Promise<number | undefined> {
  const poolMint = await cache.getMint(connection, pool.pubkeys.mint);
  const accountA = await cache.getAccount(
    connection,
    pool.pubkeys.holdingAccounts[0]
  );
  const accountB = await cache.getAccount(
    connection,
    pool.pubkeys.holdingAccounts[1]
  );
  if (!poolMint.mintAuthority) {
    throw new Error("Mint doesnt have authority");
  }

  if (poolMint.supply === 0n) {
    return;
  }

  const mintA = await cache.getMint(connection, accountA.info.mint);
  const mintB = await cache.getMint(connection, accountB.info.mint);

  if (!mintA || !mintB) {
    return;
  }

  const isFirstIndependent = accountA.info.mint.toBase58() === independent;
  const depPrecision = Math.pow(
    10,
    isFirstIndependent ? mintB.decimals : mintA.decimals
  );
  const indPrecision = Math.pow(
    10,
    isFirstIndependent ? mintA.decimals : mintB.decimals
  );
  const adjAmount = amount * indPrecision;

  const dependentTokenAmount = isFirstIndependent
    ? (bigintToNumber(accountB.info.amount) / bigintToNumber(accountA.info.amount)) *
      adjAmount
    : (bigintToNumber(accountA.info.amount) / bigintToNumber(accountB.info.amount)) *
      adjAmount;

  return dependentTokenAmount / depPrecision;
}

// TODO: add ui to customize curve type
async function _addLiquidityNewPool(
  wallet: Wallet,
  walletContext: WalletContextState,
  connection: Connection,
  components: LiquidityComponent[],
  options: PoolConfig
) {
  notify({
    message: "Creating new pool...",
    description: "Please review transactions to approve.",
    type: "warning",
  });

  const walletKey = wallet.adapter.publicKey;

  if (components.some((c) => !c.account) || !walletKey) {
    notify({
      message: "You need to have balance for all legs in the basket...",
      description: "Please review inputs.",
      type: "error",
    });
    return;
  }

  

  let instructions: TransactionInstruction[] = [];
  let cleanupInstructions: TransactionInstruction[] = [];

  const liquidityTokenAccount = new Keypair();
  // Create account for pool liquidity token
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: walletKey,
      newAccountPubkey: liquidityTokenAccount.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(
        MintLayout.span
      ),
      space: MintLayout.span,
      programId: programIds().token,
    })
  );

  const tokenSwapAccount = new Keypair();

  const [authority, nonce] = PublicKey.findProgramAddressSync(
    [tokenSwapAccount.publicKey.toBuffer()],
    programIds().swap
  );

  // create mint for pool liquidity token
  instructions.push(
    createInitializeMintInstruction(
      liquidityTokenAccount.publicKey,
      LIQUIDITY_TOKEN_PRECISION,
      // pass control of liquidity mint to swap program
      authority,
      // swap program can freeze liquidity token mint
      null,
      programIds().token,
    )
  );

  // Create holding accounts for
  const accountRentExempt = await connection.getMinimumBalanceForRentExemption(
    AccountLayout.span
  );
  const holdingAccounts: Keypair[] = [];
  let signers: Keypair[] = [];

  components.forEach((leg) => {
    if (!leg.account) {
      return;
    }

    const mintPublicKey = leg.account.info.mint;
    // component account to store tokens I of N in liquidity poll
    holdingAccounts.push(
      createSplAccount(
        instructions,
        walletKey,
        accountRentExempt,
        mintPublicKey,
        authority,
        AccountLayout.span
      )
    );
  });

  // creating depositor pool account
  const depositorAccount = createSplAccount(
    instructions,
    walletKey,
    accountRentExempt,
    liquidityTokenAccount.publicKey,
    walletKey,
    AccountLayout.span
  );

  // creating fee pool account its set from env variable or to creater of the pool
  // creater of the pool is not allowed in some versions of token-swap program
  const feeAccount = createSplAccount(
    instructions,
    walletKey,
    accountRentExempt,
    liquidityTokenAccount.publicKey,
    SWAP_PROGRAM_OWNER_FEE_ADDRESS || walletKey,
    AccountLayout.span
  );

  // create all accounts in one transaction
  let tx = await sendTransaction(connection, wallet, walletContext, instructions, [
    liquidityTokenAccount,
    depositorAccount,
    feeAccount,
    ...holdingAccounts,
    ...signers,
  ]);

  notify({
    message: "Accounts created",
    description: `Transaction ${tx}`,
    type: "success",
  });

  notify({
    message: "Adding Liquidity...",
    description: "Please review transactions to approve.",
    type: "warning",
  });

  signers = [];
  instructions = [];
  cleanupInstructions = [];

  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: walletKey,
      newAccountPubkey: tokenSwapAccount.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(
        TokenSwapLayout.span
      ),
      space: TokenSwapLayout.span,
      programId: programIds().swap,
    })
  );

  components.forEach((leg, i) => {
    if (!leg.account) {
      return;
    }

    // create temporary account for wrapped sol to perform transfer
    const from = getWrappedAccount(
      instructions,
      cleanupInstructions,
      leg.account,
      walletKey,
      leg.amount + accountRentExempt,
      signers
    );

    instructions.push(
      createTransferInstruction(
        from,
        holdingAccounts[i].publicKey,
        walletKey,
        leg.amount,
        [],
        programIds().token,

      )
    );
  });

  instructions.push(
    TokenSwap.createInitSwapInstruction(
      tokenSwapAccount,
      authority,
      holdingAccounts[0].publicKey,
      holdingAccounts[1].publicKey,
      liquidityTokenAccount.publicKey,
      feeAccount.publicKey,
      depositorAccount.publicKey,
      programIds().token,
      programIds().swap,
      // nonce,
      numberToBigint(options.tradeFeeNumerator),
      numberToBigint(options.tradeFeeDenominator),
      numberToBigint(options.ownerTradeFeeNumerator),
      numberToBigint(options.ownerTradeFeeDenominator),
      numberToBigint(options.ownerWithdrawFeeNumerator),
      numberToBigint(options.ownerWithdrawFeeDenominator),
      HOST_FEE_NUMERATOR, //TODO: Add to UI
      HOST_FEE_DENOMINATOR,
      options.curveType,
    )
  );

  // All instructions didn't fit in single transaction
  // initialize and provide inital liquidity to swap in 2nd (this prevents loss of funds)
  tx = await sendTransaction(
    connection,
    wallet,
    walletContext,
    instructions.concat(cleanupInstructions),
    [tokenSwapAccount, ...signers]
  );

  notify({
    message: "Pool Funded. Happy trading.",
    type: "success",
    description: `Transaction - ${tx}`,
  });
}

function getWrappedAccount(
  instructions: TransactionInstruction[],
  cleanupInstructions: TransactionInstruction[],
  toCheck: TokenAccount,
  payer: PublicKey,
  amount: number,
  signers: Keypair[]
) {
  if (!toCheck.info.isNative) {
    return toCheck.pubkey;
  }

  const account = new Keypair();
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: amount,
      space: AccountLayout.span,
      programId: programIds().token,
    })
  );

  instructions.push(
    createInitializeAccountInstruction(
      account.publicKey,
      WRAPPED_SOL_MINT,
      payer,
      programIds().token,
    )
  );

  cleanupInstructions.push(
    createCloseAccountInstruction(
      account.publicKey,
      payer,
      payer,
      [],
      programIds().token,
    )
  );

  signers.push(account);

  return account.publicKey;
}

function createSplAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  mint: PublicKey,
  owner: PublicKey,
  space: number
) {
  const account = new Keypair();
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: accountRentExempt,
      space,
      programId: programIds().token,
    })
  );

  instructions.push(
    createInitializeAccountInstruction(
      account.publicKey,
      mint,
      owner,
      programIds().token,
    )
  );

  return account;
}
