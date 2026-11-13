# Testnet kanıtı

Bu klasör gerçek, herkese açık ve yeniden doğrulanabilir testnet transaction kimlikleri içindir. Mevcut manifest `not-deployed` durumundadır; bu bilinçli ve doğru bir teslim durumudur.

Deploy sonrası en az şu işlemler kaydedilmelidir: deploy/init, service registration, series listing, funding/NFT mint, customer payment, delivery commitment, confirmation, NFT transfer, transfer sonrası ikinci confirmation, withdrawal. Her kimlik explorer ve finalized RPC üzerinden doğrulanmalıdır.

`npm run verify:ledger -- evidence/testnet-transactions.json` placeholder, eksik contract ID veya deploy edilmemiş durumu başarısız sayar.
