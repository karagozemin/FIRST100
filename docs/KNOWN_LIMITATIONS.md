# Known limitations

- The contract cannot technically prevent a seller from collecting the same economic API revenue through another channel or contract. It secures only orders routed through this contract.
- Settlement depends on customer confirmation. There is no automated quality oracle or dispute resolution mechanism.
- Local gateway persistence is an atomic JSON file designed for one process. Hosted challenges are stateless and signed. Time-bounded onchain leases prevent concurrent adapter execution across instances and permit retry after a crashed worker.
- There is no distributed transaction between service execution and the onchain delivery call. The included services are deterministic and replayable; any side-effecting adapter must provide a durable idempotency receipt at its own boundary.
- One NFT represents the entire remaining first-N entitlement for one series. Fractional ownership is not implemented.
- Marketplace pricing, secondary sales, DAO governance, and multi-token payments are planned product phases and are not current capabilities.
- Testnet deployment and real explorer evidence are complete; an independent security audit is not.
- The current official NEAR wallet and crypto dependency tree reports low-severity `elliptic` findings in npm audit. There are no high- or moderate-severity production findings. Recheck upstream status before mainnet use.
- Legal classification, taxation, and securities compliance are not addressed at the product layer.
