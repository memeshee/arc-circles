# Verifying CircleFactory on the Arc explorer

Automated verification (`forge verify-contract --verifier blockscout`)
is currently blocked: `explorer.arc.io` serves a Cloudflare managed
challenge to non-browser API clients, so both `forge` and raw API calls
get an HTML challenge page instead of JSON. This folder contains
everything needed to verify by hand in ~2 minutes via the Blockscout
"Verify & Publish" form.

## Contract

- Address: `0x6792E51FBD24f9315282BD5b6c5E713dCc779C69`
- Contract name: `CircleFactory` (in `src/SavingsCircle.sol`)
- Creation tx: `0x04bbc8874fcaa685ee8bcc1ea7b9fdc3dc56c5bf6d37f83f808087bb8338e05f`
- Deployer: `0x4Ba1e9e275EF61B56C99532D0066506436201D73`

## Exact compiler settings (from `out/SavingsCircle.sol/CircleFactory.json`)

- Solidity: `v0.8.37+commit.f401782d`
- Optimizer: **disabled** (runs: 200 — ignored when disabled)
- EVM version: `osaka`
- License: MIT (`SPDX-License-Identifier: MIT`)
- Constructor arguments: none (`CircleFactory` takes no constructor args)
- Source: `verification/CircleFactory.flattened.sol` (produced by
  `forge flatten src/SavingsCircle.sol`; single SPDX line is expected —
  flatteners dedupe it)

## Steps

1. Open the address on https://explorer.arc.io/address/0x6792E51FBD24f9315282BD5b6c5E713dCc779C69
2. Contract tab → "Verify & Publish" → method: flattened source.
3. Paste `CircleFactory.flattened.sol`, contract name `CircleFactory`,
   compiler `v0.8.37`, optimizer off, EVM `osaka`, license MIT.
4. Publish. Bytecode must match exactly — it was compiled from the
   committed `src/SavingsCircle.sol` at the pinned settings above.

Circle instances need no separate verification: they are deployed by the
factory from the same source (`SavingsCircle` in the same file).
