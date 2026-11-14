# Uang Bersama

Aplikasi pencatatan keuangan rumah tangga. Buka `index.html` melalui server HTTP. Supabase Auth memakai email dan kata sandi. Setoran tabungan mengurangi saldo yang bisa dipakai, dan saldo awal dicatat sebagai pemasukan.

## Pengaturan

Terapkan `schema.sql` sekali pada proyek Supabase baru. Buat akun menggunakan formulir pendaftaran, konfirmasi email, lalu administrator menambahkan masing-masing ID akun ke `public.household_members` dengan `household_id` UUID yang sama. Hanya anggota yang ditambahkan dapat mengakses data. Atur URL situs dan redirect Supabase Auth sesuai alamat aplikasi yang dipasang. Kunci publishable pada `app.js` memang untuk browser; jangan tambahkan service role key ke kode.

Data diperbarui saat halaman aktif setiap 15 detik. Tindakan simpan yang gagal bisa dicoba ulang tanpa membuat ID transaksi baru. Aplikasi belum diuji dengan dua akun nyata dan perlu uji menyeluruh sebelum digunakan untuk data keuangan sebenarnya.

