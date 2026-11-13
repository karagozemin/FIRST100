# Service agent

P0 service agent uygulaması `gateway/` içindedir. Finalized NEAR RPC kullanarak verilen hesabın bakiyesini, kilitli bakiyesini, storage kullanımını, code hash'ini ve account/contract sınıfını döndürür. Sonuç deterministik canonical JSON ile hash'lenir ve gateway hesabı hash'i kontrata gönderir.

Bu dizin PRD'deki agent sınırını görünür tutar; ikinci bir runtime veya kopya uygulama içermez.
