# FIRST100

FIRST100, bir AI servisinin sınırlı sayıdaki gelecekteki satışını peşin finansmana dönüştüren NEAR protokolüdür. Yatırımcı fonlamayı tamamladığında bir NEP-171 gelir hakkı NFT'si alır. Her müşteri satışı zincirde ödenir; gateway gerçek servis çıktısının hash'ini kaydeder; müşteri çıktıyı onayladığında gelir o anda NFT'yi elinde tutan hesaba tahakkuk eder.

Bu depo PRD v2.0'ın P0 çekirdeğini uygular. Testnet deploy'u henüz yapılmadığı için gerçek işlem hash'i iddia etmez; kanıt dosyası bilerek `not-deployed` durumundadır.

## Çalışan kapsam

- Rust/NEAR kontratı: servis kaydı, seri listeleme, tek seferlik finansman, NFT mint, ücretli sipariş, teslimat hash'i, müşteri onayı, timeout iadesi ve pull-payment çekimi.
- Gelir hakkı: geçmiş tahakkuk eski hesapta kalır; transferden sonra kesinleşen ilk `N` satış yeni NFT sahibine gider; `N` sonrasındaki satışlar satıcıya döner.
- NEP-171: `nft_transfer`, `nft_transfer_call` ve resolver. Asenkron transfer sonuçlanana kadar settlement kilitlidir.
- Muhasebe: kredi, escrow ve in-flight çekim toplamları; taşma/alt-taşma koruması; başarısız transferde tek seferlik geri yazma; denetlenebilir `audit_totals` görünümü.
- Gateway: finalized NEAR RPC, NEP-413 cüzdan kanıtı, ödeme işlemi doğrulaması, istek hash'i kontrolü, kalıcı/idempotent kayıt ve gerçek NEAR hesap araştırma servisi.
- React uygulaması: satıcı, yatırımcı, müşteri, hak sahibi ve kanıt ekranları.
- SDK: canonical JSON hash'leme, RPC istemcisi ve bağımsız ledger replay doğrulayıcısı.

## Mimari

```text
Seller ──register/list──▶ NEAR contract ◀──fund/mint── Investor
                              ▲   │                         │
                              │   └── NEP-171 future right ─┘
Customer ──pay order──────────┤
   │                          │
   └──NEP-413──▶ Gateway ──delivery hash──▶ contract
        │            │                         │
        │            └── finalized RPC data   └──buyer confirm
        └──────── verified output ◀────────────── revenue credit
```

Detaylar: [mimari](docs/ARCHITECTURE.md), [invariant'lar](docs/INVARIANTS.md), [tehdit modeli](docs/THREAT_MODEL.md), [bilinen sınırlar](docs/KNOWN_LIMITATIONS.md).

## Hızlı başlangıç

Gereksinimler: Node.js 22+, npm, Rust 1.95 ve `wasm32-unknown-unknown`. Build script'i resmi cargo-near 0.23.0 binary'sini platforma göre proje cache'ine indirir ve çalıştırmadan önce sürümünü doğrular.

```bash
npm install
rustup target add wasm32-unknown-unknown --toolchain 1.95.0
cp .env.example .env
npm test
npm run build:contract
npm run test:workspaces
```

`test:workspaces`, NEAR sandbox 2.14.0 binary'sini proje içindeki `.cache` klasörüne indirir ve sürümünü çalıştırmadan önce doğrular. Desteklenen geliştirme platformları Apple Silicon macOS ve x86_64 Linux'tur.

Yerel UI ve gateway:

```bash
npm run dev:gateway
npm run dev:app
```

`.env` içinde gerçek `CONTRACT_ID`, gateway hesabı ve gateway private key'i gerekir. Private key'i repoya eklemeyin.

## Testler

```bash
npm run test:contract      # 31 Rust birim/adversarial testi
npm run test -w gateway    # ödeme, auth, hash ve idempotency entegrasyonu
npm run test -w sdk        # canonical hash ve ledger doğrulama
npm run test:workspaces    # gerçek WASM + 6 sandbox hesabı
npm run test:e2e           # beş rollü UI için Chromium smoke testi
npm run build              # gateway, UI ve SDK TypeScript üretimi
```

Sandbox testi şu akışı aynı zincir durumunda doğrular: satıcı kayıt/listeler → yatırımcı A fonlar → müşteri C öder/onaylar → A'nın NFT'si B'ye geçer → müşteri D öder/onaylar → A'nın eski kredisi korunur, yeni kredi B'ye gider → cap sonrası satış satıcıya döner → toplam yükümlülükler uzlaşır.

## Testnet deploy

Önce kontrol ettiğiniz testnet hesaplarını ayarlayın:

```bash
export CONTRACT_ID=first100-yourname.testnet
export OWNER_ID=yourname.testnet
npm run deploy:testnet
```

Deploy script'i imza için yerel NEAR keychain kullanır; gizli anahtar kabul etmez. İşlem tamamlandıktan sonra yalnızca gerçek hash'leri `evidence/testnet-transactions.json` içine yazın ve doğrulayın:

```bash
npm run verify:ledger -- evidence/testnet-transactions.json
```

Doğrulayıcı placeholder veya `not-deployed` kanıtını başarılı saymaz.

## Kontratın para girişleri

| Metot | Ekli depozito |
| --- | ---: |
| `register_service` | tam `0.01 NEAR` |
| `create_series` | tam `0.02 NEAR` |
| `fund_series` | tam seri avansı |
| `create_order` | tam birim fiyat |
| `nft_transfer*` | `1 yoctoNEAR` |
| `withdraw` | `1 yoctoNEAR` |

Tüm finansal miktarlar JSON'da decimal yoctoNEAR string'i olarak taşınır. Timestamp'ler de JS precision kaybını önlemek için decimal nanosaniye string'idir.

## Teslim durumu

- Yerel üretim build'i: hazır.
- Birim/gateway/SDK testleri: geçiyor.
- NEAR sandbox uçtan uca testleri: geçiyor.
- Testnet deploy ve gerçek explorer hash'leri: **yapılmadı**.
- Harici güvenlik denetimi: **yapılmadı**.

Yarışma metni için [HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md), 90 saniyelik akış için [demo senaryosu](docs/DEMO_SCRIPT.md) kullanılabilir.

## Lisans

MIT — bkz. [LICENSE](LICENSE).
