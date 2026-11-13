# Bilinen sınırlar

- Kontrat, satıcının aynı ekonomik API gelirini başka bir kanal veya başka bir kontrat üzerinden toplamasını teknik olarak engelleyemez. Yalnızca bu kontrattan geçen siparişleri güvenceye alır.
- Settlement müşteri onayına bağlıdır. Otomatik kalite oracle'ı veya uyuşmazlık çözümü yoktur.
- Gateway P0 kalıcı deposu tek süreçli atomik JSON dosyasıdır. Çok instance üretim dağıtımı için transaction/unique constraint sunan bir veritabanı gerekir.
- Gateway servis çağrısı ile onchain delivery işlemi arasında dağıtık transaction yoktur. Servis deterministik ve yeniden yürütülebilir tasarlanmıştır; üretimde pending/lease tablosu eklenmelidir.
- Bir NFT tek serinin tüm kalan ilk-N hakkını taşır; fraksiyonlaştırma yoktur.
- Marketplace, ikincil satış fiyatlandırması, DAO yönetişimi ve çoklu token ödemeleri P0 dışıdır.
- Testnet deploy, gerçek explorer hash'leri ve bağımsız güvenlik denetimi henüz yoktur.
- Güncel resmi NEAR wallet/crypto bağımlılık ağacı npm audit'te düşük önem dereceli `elliptic` uyarıları üretmektedir; high/moderate üretim uyarısı yoktur. Mainnet öncesi upstream düzeltmesiyle yeniden taranmalıdır.
- Hukuki sınıflandırma, vergi ve menkul kıymet uyumu ürün katmanında çözülmemiştir.
