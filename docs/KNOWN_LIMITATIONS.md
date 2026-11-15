# Known limitations

- The contract cannot technically prevent a seller from collecting the same economic API revenue through another channel or contract. It secures only orders routed through this contract.
- Settlement depends on customer confirmation. There is no automated quality oracle or dispute resolution mechanism.
- Local gateway persistence is an atomic JSON file designed for one process. Hosted challenges are stateless and signed, while onchain state prevents duplicate delivery transitions. Mainnet multi-instance execution still requires a transactional database with leases and unique constraints.
- There is no distributed transaction between service execution and the onchain delivery call. The service is deterministic and replayable; production should add a pending execution and lease table.
- One NFT represents the entire remaining first-N entitlement for one series. Fractional ownership is not implemented.
- Marketplace pricing, secondary sales, DAO governance, and multi-token payments are planned product phases and are not current capabilities.
- Testnet deployment and real explorer evidence are complete; an independent security audit is not.
- The current official NEAR wallet and crypto dependency tree reports low-severity `elliptic` findings in npm audit. There are no high- or moderate-severity production findings. Recheck upstream status before mainnet use.
- Legal classification, taxation, and securities compliance are not addressed at the product layer.
