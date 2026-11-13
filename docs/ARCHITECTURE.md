# Mimari ve güven sınırları

## Kaynak dizinleri

- `contracts/revenue-rights`: onchain durum makinesi ve NEP-171 hakkı.
- `gateway`: ödeme ve cüzdan kanıtını doğrulayan, servisi çalıştıran ve yanıt hash'ini zincire yazan süreç.
- `sdk`: UI'dan bağımsız hash/RPC/ledger doğrulama araçları.
- `app`: beş rollü React istemcisi.
- `tests/workspaces`: derlenmiş WASM'ı güncel NEAR sandbox üzerinde çalıştıran entegrasyon testi.
- `evidence`: yalnızca yeniden doğrulanabilir testnet işlem kimlikleri için ayrılmış alan.

## Durum makinesi

Seri: `LISTED → FUNDED → CLOSED`; fonlanmamış seri `CANCELLED` olabilir. Aynı servis kimliği için aynı anda yalnızca bir fonlanmış aktif seri bulunabilir.

Sipariş: `PAID_PENDING → DELIVERED → SETTLED`. Son tarihe kadar kesinleşmeyen `PAID_PENDING` veya `DELIVERED` sipariş, alıcı tarafından `REFUNDED` yapılabilir. Terminal durum tekrar işlenemez.

Çekim: `IN_FLIGHT → COMPLETED | RESTORED`. Callback sadece kontratın kendisinden gelir ve bir terminal sonuç ikinci kez uygulanamaz.

## Settlement anı

Hak sahibi sipariş açılırken sabitlenmez. Müşterinin `confirm_delivery` çağrısının işlendiği blokta `owner_by_id` okunur. Böylece transferden önce tahakkuk etmiş kredi eski hesapta kalırken sonraki kesinleşen gelir yeni sahibine gider. `nft_transfer_call` resolver beklenirken `pending_transfers` kilidi settlement'ı durdurur; resolver transferi kabul eder veya geri alır, sonra kilit açılır.

## Offchain doğrulama

Gateway otorite kaynağı değildir. Kontrat/order verisini finalized RPC'den okur; NEP-413 imzasının aktif full-access key'e ait olduğunu, ödeme transaction'ının doğru signer/order sonucu içerdiğini ve request body'sinin onchain hash ile eşleştiğini kontrol eder. Çıktı kalitesi yine müşterinin onayına bağlıdır.
