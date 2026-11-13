# Tehdit modeli

## Korunan varlıklar

- Fonlama avansı, müşteri escrow'u ve hesap kredileri.
- İlk `N` kesinleşmiş satışın devredilebilir gelir hakkı.
- Sipariş isteği/yanıtı ile onchain hash arasındaki bağ.
- Aynı satışın veya aynı nonce'ın tekrar işlenmemesi.

## Savunmalar

- Yetki: servis ve seri operatöre; teslimat gateway veya operatöre; onay/refund sipariş alıcısına; transfer NFT sahibine bağlıdır.
- Replay: buyer + series + client nonce tek kullanımlıdır. Gateway wallet challenge'ı kısa ömürlü ve tek kullanımlıdır.
- Fiyat: exact-deposit kontrolü under/overpayment'ı reddeder.
- Çifte settlement/refund: terminal order status ve checked arithmetic.
- Transfer yarışı: asenkron NEP-171 resolver süresince token-level settlement kilidi.
- Çekim yarışı: kredi önce düşülür, in-flight kaydı açılır; callback sonucu başarı veya tek geri yazmadır.
- Gateway: finalized RPC, active access-key kontrolü, NEP-413, payment transaction ve request commitment doğrulaması.
- Kanıt sahteciliği: ledger doğrulayıcı placeholder ve deploy edilmemiş manifesti reddeder.

## Güvenilen bileşenler

- NEAR konsensüsü ve seçilen finalized RPC sağlayıcıları.
- Gateway hesabının private key'i ve gateway host güvenliği.
- Müşterinin aldığı çıktıyı dürüst değerlendirmesi.
- Satıcının bu servis gelirini FIRST100 dışından tahsil etmeme taahhüdü.

Gateway ele geçirilirse yanlış bir response hash yazabilir ancak müşterinin onayı olmadan gelir settle edemez. Müşteri kötü niyetliyse doğru çıktıyı onaylamayı reddedebilir; timeout sonunda fonu iade edebilir. Bu P0'da arabuluculuk yoktur.
