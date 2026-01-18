# Contract Addresses

> Official Arc Testnet contract addresses for USDC, EURC, and crosschain components such as CCTP and Gateway.

## Stablecoins

Stablecoins are the foundation of the Arc ecosystem, supporting a growing set of
fiat-backed and yield-bearing tokens. These assets provide price stability,
onchain yield, and multi-currency support for payments, FX, and financial
applications. The ERC-20 functions affect native balance movements.

### USDC

USDC is the native EVM asset on Arc and is used for gas fees. The native
balance, consistent with most EVM implementations, expresses the balance up to
18 decimals of precision.

An optional USDC ERC-20 interface is also available for developers who need
ERC-20 features such as `transferFrom`, `approve`, and allowance management. The
ERC-20 function call directly affects native USDC balance movements.

| Contract | Address                                                                                                                        | Notes                                                                                    |
| :------- | :----------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **USDC** | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) | Optional ERC-20 interface for interacting with the native USDC balance. Uses 6 decimals. |

<Info>
  **Getting testnet USDC:** You can request USDC on Arc Testnet from the
  [Circle Faucet](https://faucet.circle.com/). USDC is required to pay for gas and
  interact with contracts on Arc.

  **Note:** As with any ERC-20 token, always use the `decimals()` function to
  interpret balances and transfer amounts accurately. On Arc, the **native USDC
  gas token** uses 18 decimals of precision, while the **USDC ERC-20 interface**
  uses 6 decimals. Avoid mixing these values directly, as doing so may result in
  incorrect balance handling. For applications integrating USDC, it's recommended
  to rely solely on the standard ERC-20 interface for reading balances and sending
  transfers.
</Info>

### EURC

EURC is the euro-denominated stablecoin issued by Circle and supported natively
on Arc for use in payments, FX, and other financial applications.

| Contract | Address                                                                                                                        | Notes                                      |
| :------- | :----------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| **EURC** | [`0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`](https://testnet.arcscan.app/address/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a) | Main EURC token contract. Uses 6 decimals. |

<Info>
  **Getting testnet EURC:** Testnet EURC can be requested from the [Circle
  Faucet](https://faucet.circle.com/). Select **Arc Testnet** as the network and
  **EURC** as the token to receive a small test allocation.
</Info>

### USYC

USYC is a yield-bearing token issued by Circle International Bermuda Ltd. and
supported on Arc for institutional and DeFi use cases. It represents shares of a
tokenized money market fund backed by short-duration U.S. Treasury securities,
offering onchain access to regulated, low-risk yield.

| Contract         | Address                                                                                                                        | Notes                                                                                              |
| :--------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **USYC**         | [`0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C`](https://testnet.arcscan.app/address/0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C) | The main USYC token contract representing tokenized money market fund shares. Uses 6 decimals.     |
| **Entitlements** | [`0xcc205224862c7641930c87679e98999d23c26113`](https://testnet.arcscan.app/address/0xcc205224862c7641930c87679e98999d23c26113) | Manages allowlisted access and entitlement controls for permissioned addresses on the Arc Testnet. |
| **Teller**       | [`0x9fdF14c5B14173D74C08Af27AebFf39240dC105A`](https://testnet.arcscan.app/address/0x9fdF14c5B14173D74C08Af27AebFf39240dC105A) | Contract used to mint and redeem testnet USYC from testnet USDC once your wallet is allowlisted.   |

<Info>
  **Getting testnet USYC:**

  1. Obtain testnet USDC from the [Circle Faucet](https://faucet.circle.com/).
  2. Request allowlisting by opening a ticket with
     [Circle Support](https://support.circle.com/) and include your Arc Testnet
     wallet address. Requests are typically processed in 24–48 hours.
  3. Once approved, call the USYC Teller contract or interact with the
     [USYC Portal](https://usyc.dev.hashnote.com/) to deposit testnet USDC and
     receive testnet USYC.

  For more information on issuance, redemption, and eligibility, see
  [USYC Overview](https://developers.circle.com/tokenized/usyc/overview).
</Info>

## Crosschain

The contracts below enable crosschain interoperability between Arc and other
blockchains through Circle's
[Cross-Chain Transfer Protocol](https://developers.circle.com/cctp) (CCTP) and
[Gateway](https://developers.circle.com/gateway). CCTP handles crosschain
message passing and stablecoin transfers, while Gateway provides
chain-abstracted USDC balances for seamless liquidity movement.

### CCTP

| Contract                 | Domain | Address                                                                                                                        |
| :----------------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------- |
| **TokenMessengerV2**     | 26     | [`0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`](https://testnet.arcscan.app/address/0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA) |
| **MessageTransmitterV2** | 26     | [`0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`](https://testnet.arcscan.app/address/0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275) |
| **TokenMinterV2**        | 26     | [`0xb43db544E2c27092c107639Ad201b3dEfAbcF192`](https://testnet.arcscan.app/address/0xb43db544E2c27092c107639Ad201b3dEfAbcF192) |
| **MessageV2**            | 26     | [`0xbaC0179bB358A8936169a63408C8481D582390C4`](https://testnet.arcscan.app/address/0xbaC0179bB358A8936169a63408C8481D582390C4) |

### Gateway

| Contract          | Domain | Address                                                                                                                        |
| :---------------- | :----- | :----------------------------------------------------------------------------------------------------------------------------- |
| **GatewayWallet** | 26     | [`0x0077777d7EBA4688BDeF3E311b846F25870A19B9`](https://testnet.arcscan.app/address/0x0077777d7EBA4688BDeF3E311b846F25870A19B9) |
| **GatewayMinter** | 26     | [`0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`](https://testnet.arcscan.app/address/0x0022222ABE238Cc2C7Bb1f21003F0a260052475B) |

## Payments and settlement

Arc provides payment and settlement contracts that enable foreign exchange and
onchain settlement workflows using stablecoins. These components support
application-level use cases such as FX execution and escrow-based settlement.

### StableFX

[StableFX](https://developers.circle.com/stablefx) is an enterprise-grade
stablecoin FX engine that combines Request-for-Quote (RFQ) execution with
onchain settlement on Arc. The following is the address for the escrow contract
used to settle stablecoin swaps.

| Contract     | Address                                                                                                                        | Notes                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **FxEscrow** | [`0x1f91886C7028986aD885ffCee0e40b75C9cd5aC1`](https://testnet.arcscan.app/address/0x1f91886C7028986aD885ffCee0e40b75C9cd5aC1) | The escrow contract used by both makers and takers to settle stablecoin swaps. |

<Info>
  Before executing FX trades, StableFX must be able to transfer USDC from your
  wallet. To enable this, you need to grant a USDC allowance to the Permit2
  contract. See [Common Ethereum contracts](#common-ethereum-contracts) for the
  Permit2 address.
</Info>

## Common Ethereum contracts

Arc Testnet includes a set of widely used Ethereum ecosystem contracts for
deterministic deployment, batched reads, and standardized token approvals.
Although not Circle-managed, these contracts are deployed on Arc to ensure
compatibility with common EVM tooling and workflows.

| Contract                       | Address                                                                                                                        | Notes                                                                           |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **CREATE2 Factory (Arachnid)** | [`0x4e59b44847b379578588920cA78FbF26c0B4956C`](https://testnet.arcscan.app/address/0x4e59b44847b379578588920cA78FbF26c0B4956C) | Minimal proxy for deterministic contract deployment using the `CREATE2` opcode. |
| **Multicall3**                 | [`0xcA11bde05977b3631167028862bE2a173976CA11`](https://testnet.arcscan.app/address/0xcA11bde05977b3631167028862bE2a173976CA11) | Aggregates multiple read calls into a single call for efficient data retrieval. |
| **Permit2**                    | [`0x000000000022D473030F116dDEE9F6B43aC78BA3`](https://testnet.arcscan.app/address/0x000000000022D473030F116dDEE9F6B43aC78BA3) | Universal contract for signature-based token approvals. Required for StableFX.  |


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://docs.arc.network/llms.txt