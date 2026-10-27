# Veritabanı değişiklikleri (migration)

`schema.sql` temel şemadır (her açılışta güvenle yeniden çalışır). Bundan sonraki her değişiklik
buraya yeni, numaralı bir dosya olarak eklenir: `001_...sql`, `002_...sql`. Sunucu açılırken
çalışmamış dosyaları sırayla bir kez çalıştırır ve `schema_migrations` tablosuna yazar.

Kurallar:
- Çalışmış bir dosya bir daha değiştirilmez; düzeltme yeni bir dosyayla yapılır.
- Veri silen değişiklikler (DROP) ayrı bir dosyada ve açıklamasıyla yazılır.
