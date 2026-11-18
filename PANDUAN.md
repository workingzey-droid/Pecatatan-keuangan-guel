# Uang Bersama

Aplikasi pencatatan keuangan rumah tangga. Buka melalui server HTTP. Aplikasi tidak meminta akun email atau kata sandi dan langsung memuat data rumah tangga bersama dari Supabase.

## Pengaturan

Terapkan `schema.sql` dan file migrasi SQL lain sesuai urutannya. Terapkan `public_household_access.sql` untuk membuka akses anonim hanya ke household ID yang dipakai aplikasi. Kunci publishable pada `app.js` memang untuk browser; jangan tambahkan service role key ke kode.

**Privasi:** aplikasi dan repo ini publik. Tanpa login atau kode pasangan, siapa pun yang mengetahui alamat aplikasi dapat membaca dan mengubah data rumah tangga tersebut. Row Level Security (RLS) membatasi akses ke household ID aplikasi ini; jangan masukkan informasi yang harus dirahasiakan.

Data diperbarui saat halaman aktif setiap 15 detik. Tindakan simpan yang gagal bisa dicoba ulang tanpa membuat ID transaksi baru.
