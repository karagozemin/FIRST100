# 90 saniyelik jüri demosu

## Ön koşul

Demo yalnızca gerçek testnet deploy ve `evidence/testnet-transactions.json` doğrulaması başarılı olduktan sonra yapılır. Explorer sekmeleri önceden açılır; hash veya bakiye taklit edilmez.

## Akış

**0–12 sn:** “AI servisinin ilk 100 ücretli çağrısını, şirketi veya sonraki gelirleri satmadan finanse ediyoruz.” Satıcı ekranında service/series ve cap gösterilir.

**12–25 sn:** Yatırımcı avansı gönderir. Explorer'da `series_funded` ve NEP-171 `nft_mint` event'i açılır.

**25–45 sn:** Müşteri gerçek NEAR hesabı araştırma isteğinin hash'ini ödeyerek zincire yazar, NEP-413 ile gateway'i yetkilendirir, finalized RPC çıktısını alır ve response hash'i ile eşleşmeyi görür.

**45–58 sn:** Müşteri onaylar. Holder ekranında gelir A'ya tahakkuk eder; audit toplamları gösterilir.

**58–72 sn:** A NFT'yi B'ye aktarır. A'nın eski kredisi değişmez. İkinci müşteri akışı kesinleşince yeni kredi B'ye gider.

**72–84 sn:** Cap dolduktan sonraki çağrının satıcıya döndüğü ve `settled_count` değerinin cap'i aşmadığı gösterilir.

**84–90 sn:** Proof ekranında gerçek transaction hash'leri ve bağımsız ledger verifier sonucu: “NFT spekülasyon değil; kontratın yönettiği, denetlenebilir gelecek gelir hakkı.”
