/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import { programIds, SWAP_HOST_FEE_ADDRESS, WRAPPED_SOL_MINT } from "./ids";
import { AccountLayout,  Mint, MintLayout, unpackMint, unpackAccount } from "@solana/spl-token";
import { usePools } from "./pools";
import { TokenAccount, PoolInfo } from "./../models";
import { notify } from "./notifications";


export interface AccountContextResults {
    userAccounts: TokenAccount[],
    pools: PoolInfo[],
    nativeAccount: AccountInfo<Buffer> | undefined,
}

const AccountsContext = React.createContext<AccountContextResults>({
  userAccounts: [],
  pools: [],
  nativeAccount: undefined
});

class AccountUpdateEvent extends Event {
  static type = "AccountUpdate";
  id: string;
  constructor(id: string) {
    super(AccountUpdateEvent.type);
    this.id = id;
  }
}

class EventEmitter extends EventTarget {
  raiseAccountUpdated(id: string) {
    this.dispatchEvent(new AccountUpdateEvent(id));
  }
}

const accountEmitter = new EventEmitter();

const mintCache = new Map<string, Promise<Mint>>();
const pendingAccountCalls = new Map<string, Promise<TokenAccount>>();
const accountsCache = new Map<string, TokenAccount>();

const getAccountInfo = async (connection: Connection, pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey);
  if (info === null) {
    throw new Error("Failed to find mint account");
  }

  // const buffer = Buffer.from(info.data);

  const data = unpackAccount(pubKey, info);// deserializeAccount(buffer);

  const details = {
    pubkey: pubKey,
    account: {
      ...info,
    },
    info: data,
  } as TokenAccount;

  return details;
};

const getMintInfo = async (connection: Connection, pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey);
  if (info === null) {
    throw new Error("Failed to find mint account");
  }

  // const data = Buffer.from(info.data);

  return unpackMint(pubKey, info);//  deserializeMint(data);
};

export const cache = {
  getAccount: async (connection: Connection, pubKey: string | PublicKey) => {
    let id: PublicKey;
    if (typeof pubKey === "string") {
      id = new PublicKey(pubKey);
    } else {
      id = pubKey;
    }

    const address = id.toBase58();

    const account = accountsCache.get(address);
    if (account) {
      return account;
    }

    let query = pendingAccountCalls.get(address);
    if (query) {
      return query;
    }

    query = getAccountInfo(connection, id).then((data) => {
      pendingAccountCalls.delete(address);
      accountsCache.set(address, data);
      return data;
    }) as Promise<TokenAccount>;
    pendingAccountCalls.set(address, query as any);

    return query;
  },
  getMint: async (connection: Connection, pubKey: string | PublicKey) => {
    let id: PublicKey;
    if (typeof pubKey === "string") {
      id = new PublicKey(pubKey);
    } else {
      id = pubKey;
    }

    const mint = mintCache.get(id.toBase58());
    if (mint) {
      return mint;
    }

    const query = getMintInfo(connection, id);

    mintCache.set(id.toBase58(), query as any);

    return query;
  },
};

export const getCachedAccount = (
  predicate: (account: TokenAccount) => boolean
) => {
  for (const account of accountsCache.values()) {
    if (predicate(account)) {
      return account as TokenAccount;
    }
  }
};

function wrapNativeAccount(
  pubkey: PublicKey | null,
  account?: AccountInfo<Buffer>
): TokenAccount | undefined {
  if (!account || !pubkey) {
    return undefined;
  }

  return {
    pubkey: pubkey,
    account,
    info: {
      mint: WRAPPED_SOL_MINT,
      owner: pubkey,
      amount: account.lamports,
      delegate: null,
      delegatedAmount: 0,
      isInitialized: true,
      isFrozen: false,
      isNative: true,
      rentExemptReserve: null,
      closeAuthority: null,
    },
  };
}

const UseNativeAccount = () => {
  const {connection} = useConnection();
  const { wallet, publicKey } = useWallet();

  const [nativeAccount, setNativeAccount] = useState<AccountInfo<Buffer>>();
  useEffect(() => {
    if (!connection || !publicKey) {
      return;
    }

    connection.getAccountInfo(publicKey).then((acc) => {
      if (acc) {
        setNativeAccount(acc);
      }
    });
    connection.onAccountChange(publicKey, (acc) => {
      if (acc) {
        setNativeAccount(acc);
      }
    });
  }, [setNativeAccount, wallet, publicKey, connection]);

  return { nativeAccount };
};

const PRECACHED_OWNERS = new Set<string>();
const precacheUserTokenAccounts = async (
  connection: Connection,
  owner?: PublicKey
) => {
  if (!owner) {
    return;
  }

  // used for filtering account updates over websocket
  PRECACHED_OWNERS.add(owner.toBase58());

  // user accounts are update via ws subscription
  const accounts = await connection.getTokenAccountsByOwner(owner, {
    programId: programIds().token,
  });
  accounts.value
    .map((info) => {
      const data = unpackAccount(info.pubkey, info.account); // deserializeAccount(info.account.data);
      // need to query for mint to get decimals

      // TODO: move to web3.js for decoding on the client side... maybe with callback
      const details = {
        pubkey: info.pubkey,
        account: {
          ...info.account,
        },
        info: data,
      } as TokenAccount;

      return details;
    })
    .forEach((acc) => {
      accountsCache.set(acc.pubkey.toBase58(), acc);
    });
};

export function AccountsProvider({ children = null }: React.PropsWithChildren) {
  const {connection} = useConnection();
  const { wallet, connected, publicKey } = useWallet();
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccount[]>([]);
  const [userAccounts, setUserAccounts] = useState<TokenAccount[]>([]);
  const { nativeAccount } = UseNativeAccount();
  const { pools } = usePools();

  const selectUserAccounts = useCallback(() => {
    return [...accountsCache.values()].filter(
      (a) => a.info.owner.toBase58() === publicKey?.toBase58()
    );
  }, [ publicKey]);

  useEffect(() => {
    setUserAccounts(
      [
        wrapNativeAccount(publicKey, nativeAccount),
        ...tokenAccounts,
      ].filter((a) => a !== undefined) as TokenAccount[]
    );
  }, [nativeAccount, wallet, tokenAccounts, publicKey]);

  useEffect(() => {
    if (!connection || !wallet || !publicKey) {
      setTokenAccounts([]);
    } else {
      // cache host accounts to avoid query during swap
      precacheUserTokenAccounts(connection, SWAP_HOST_FEE_ADDRESS);

      precacheUserTokenAccounts(connection, publicKey).then(() => {
        setTokenAccounts(selectUserAccounts());
      });

      // This can return different types of accounts: token-account, mint, multisig
      // TODO: web3.js expose ability to filter. discuss filter syntax
      const tokenSubID = connection.onProgramAccountChange(
        programIds().token,
        (info) => {
          // TODO: fix type in web3.js
          const id = (info.accountId as unknown) as string;
          // TODO: do we need a better way to identify layout (maybe a enum identifing type?)
          if (info.accountInfo.data.length === AccountLayout.span) {
            const data = unpackAccount(info.accountId, info.accountInfo); //deserializeAccount(info.accountInfo.data);
            // TODO: move to web3.js for decoding on the client side... maybe with callback
            const details = {
              pubkey: new PublicKey((info.accountId as unknown) as string),
              account: {
                ...info.accountInfo,
              },
              info: data,
            } as TokenAccount;

            if (
              PRECACHED_OWNERS.has(details.info.owner.toBase58()) ||
              accountsCache.has(id)
            ) {
              accountsCache.set(id, details);
              setTokenAccounts(selectUserAccounts());
              accountEmitter.raiseAccountUpdated(id);
            }
          } else if (info.accountInfo.data.length === MintLayout.span) {
            if (mintCache.has(id)) {
              // const data = Buffer.from(info.accountInfo.data);
              const mint = unpackMint(new PublicKey((info.accountId as unknown) as string), info.accountInfo); //deserializeMint(data);
              mintCache.set(id, new Promise((resolve) => resolve(mint)));
              accountEmitter.raiseAccountUpdated(id);
            }

            accountEmitter.raiseAccountUpdated(id);
          }
        },
        "singleGossip"
      );

      return () => {
        connection.removeProgramAccountChangeListener(tokenSubID);
      };
    }
  }, [connection, connected, publicKey, wallet, selectUserAccounts]);

  return (
    <AccountsContext.Provider
      value={{
        userAccounts,
        pools,
        nativeAccount,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useNativeAccount() {
  const context = useContext(AccountsContext);
  return {
    account: context.nativeAccount as AccountInfo<Buffer>,
  };
}

export function useMint(id?: string) {
  const {connection} = useConnection();
  const [mint, setMint] = useState<Mint>();

  useEffect(() => {
    if (!id) {
      return;
    }

    cache
      .getMint(connection, id)
      .then(setMint)
      .catch((err) =>
        notify({
          message: err.message,
          type: "error",
        })
      );
    const onAccountEvent = (e: Event) => {
      const event = e as AccountUpdateEvent;
      if (event.id === id) {
        cache.getMint(connection, id).then(setMint);
      }
    };

    accountEmitter.addEventListener(AccountUpdateEvent.type, onAccountEvent);
    return () => {
      accountEmitter.removeEventListener(
        AccountUpdateEvent.type,
        onAccountEvent
      );
    };
  }, [connection, id]);

  return mint;
}

export function useUserAccounts() {
  const context = useContext(AccountsContext);
  return {
    userAccounts: context.userAccounts as TokenAccount[],
  };
}

export function useAccount(pubKey?: PublicKey) {
  const {connection} = useConnection();
  const [account, setAccount] = useState<TokenAccount>();

  const key = pubKey?.toBase58();
  useEffect(() => {
    const query = async () => {
      try {
        if (!key) {
          return;
        }

        const acc = await cache.getAccount(connection, key).catch((err) =>
          notify({
            message: err.message,
            type: "error",
          })
        );
        if (acc) {
          setAccount(acc);
        }
      } catch (err) {
        console.error(err);
      }
    };

    query();

    const onAccountEvent = (e: Event) => {
      const event = e as AccountUpdateEvent;
      if (event.id === key) {
        query();
      }
    };

    accountEmitter.addEventListener(AccountUpdateEvent.type, onAccountEvent);
    return () => {
      accountEmitter.removeEventListener(
        AccountUpdateEvent.type,
        onAccountEvent
      );
    };
  }, [connection, key]);

  return account;
}

export function useCachedPool() {
  const context = useContext(AccountsContext);
  return {
    pools: context.pools as PoolInfo[],
  };
}

export const useSelectedAccount = (account: string) => {
  const { userAccounts } = useUserAccounts();
  const index = userAccounts.findIndex(
    (acc) => acc.pubkey.toBase58() === account
  );

  if (index !== -1) {
    return userAccounts[index];
  }

  return;
};

export const useAccountByMint = (mint: string) => {
  const { userAccounts } = useUserAccounts();
  const index = userAccounts.findIndex(
    (acc) => acc.info.mint.toBase58() === mint
  );

  if (index !== -1) {
    return userAccounts[index];
  }

  return;
};

// TODO: expose in spl package
// const deserializeAccount = (data: Buffer) => {
//   const accountInfo =  AccountLayout.decode(data);
//   accountInfo.mint = new PublicKey(accountInfo.mint);
//   accountInfo.owner = new PublicKey(accountInfo.owner);
//   accountInfo.amount = u64.fromBuffer(accountInfo.amount);

//   if (accountInfo.delegateOption === 0) {
//     accountInfo.delegate = null;
//     accountInfo.delegatedAmount = new u64(0);
//   } else {
//     accountInfo.delegate = new PublicKey(accountInfo.delegate);
//     accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
//   }

//   accountInfo.isInitialized = accountInfo.state !== 0;
//   accountInfo.isFrozen = accountInfo.state === 2;

//   if (accountInfo.isNativeOption === 1) {
//     accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
//     accountInfo.isNative = true;
//   } else {
//     accountInfo.rentExemptReserve = null;
//     accountInfo.isNative = false;
//   }

//   if (accountInfo.closeAuthorityOption === 0) {
//     accountInfo.closeAuthority = null;
//   } else {
//     accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
//   }

//   return accountInfo;
// };

// TODO: expose in spl package
// const deserializeMint = (data: Buffer) => {
//   if (data.length !== MintLayout.span) {
//     throw new Error("Not a valid Mint");
//   }

//   const mintInfo = unpackMint() MintLayout.decode(data);

//   if (mintInfo.mintAuthorityOption === 0) {
//     mintInfo.mintAuthority = null;
//   } else {
//     mintInfo.mintAuthority = new PublicKey(mintInfo.mintAuthority);
//   }

//   mintInfo.supply = u64.fromBuffer(mintInfo.supply);
//   mintInfo.isInitialized = mintInfo.isInitialized !== 0;

//   if (mintInfo.freezeAuthorityOption === 0) {
//     mintInfo.freezeAuthority = null;
//   } else {
//     mintInfo.freezeAuthority = new PublicKey(mintInfo.freezeAuthority);
//   }

//   return mintInfo as MintInfo;
// };
