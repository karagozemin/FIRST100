# Muhasebe ve protokol invariant'ları

1. Bir seri yalnızca `LISTED` durumunda ve tam avansla bir kez fonlanır.
2. Bir servis aynı anda en fazla bir aktif fonlanmış seriye sahiptir.
3. Bir alıcı/seri/client nonce bileşimi yalnızca bir sipariş üretir.
4. Sipariş depozitosu tam birim fiyattır; eksik veya fazla ödeme kabul edilmez.
5. Her sipariş en fazla bir terminal sonuca gider: settlement veya refund.
6. `settled_count` yalnızca NFT sahibine yönlenen kesinleşmiş satışlarda artar ve `cap_n` değerini geçmez.
7. Cap dolduktan sonraki gelir NFT sahibine değil satıcıya yazılır.
8. NFT transferi mevcut hesap kredilerini taşımaz; yalnızca gelecekteki settlement alıcısını değiştirir.
9. Resolver bekleyen transfer varken aynı token'a settlement yapılamaz.
10. `total_liabilities = total_credits + active_order_escrow + in_flight_withdrawals`.
11. Başarısız çekim callback'i miktarı bir kez krediye geri yazar; başarılı callback kredi üretmez.
12. Solvency görünümü storage maliyeti ve operating reserve düşüldükten sonra yükümlülükleri karşılaştırır.

Bu kurallar Rust adversarial testleri ve mümkün olan durumlar için workspaces akışıyla sınanır. `audit_totals` dış denetçinin toplamları bağımsız yeniden hesaplamasını kolaylaştırır; ekonomik doğruluğun veya harici servis kalitesinin garantisi değildir.
