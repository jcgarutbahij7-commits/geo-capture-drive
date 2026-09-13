# Field Report Sync

Buatkan saya aplikasi untuk mengirim data berupa photo dan text dari handphone android ke Google Drive. Data di Google Drive akan disinkronkan otomatis ke PC Owner menggunakan Google Drive for Desktop mode Mirror.

LOGIN PETUGAS 1kali :

NAMA PERUSAHAAN  TULISAN KAPITAL

NAMA PETUGAS TULISAN KAPITAL

NOMOR HANDPHONE PETUGAS NUMERIK KEYBOARD

bisa di edit kapan saja.

slide 1

Berikut form textnya :

1.NAMA DESA TULISAN KAPITAL

2.NOMOR CPCL  NUMERIK KEYBOARD

3.NAMA CPCL TULISAN KAPITAL

4.pelimpahan YA atau BUKAN, dropbox, JIKA YA lalu MASUKAN NAMA PELIMPAHAN jika BUKAN tidak perlu diisi

5.NIK CPCL NUMERIK KEYBOARD

6.ALAMAT CPCL  TULISAN KAPITAL

7.NOMOR HANDPHONE CPCL NUMERIK KEYBOARD

8.TOMBOL SELANJUTNYA UNTUK MASUK KE SLIDE 2

slide 2

Berikut box kirim photo :

di Tampilan slide ke 2 gps handphone mulai berjalan di belakang layar agar koordinat lebih akurat didapat,

1. Photo selfie  tampilkan thumbnail hasil photonya,

2. Photo material  tampilkan thumbnail hasil photonya,

3. Photo ktp  tampilkan thumbnail hasil photonya,

4. Photo grounding  tampilkan thumbnail hasil photonya,

5. Photo mcb  tampilkan thumbnail hasil photonya,

6. Photo fitting  tampilkan thumbnail hasil photonya,

7. Photo kabel  tampilkan thumbnail hasil photonya,

8. Photo saklar tunggal  tampilkan thumbnail hasil photonya,

9. Photo saklar ganda  tampilkan thumbnail hasil photonya,

10. Photo stopkontak  tampilkan thumbnail hasil photonya,

11. Photo tdos  tampilkan thumbnail hasil photonya,

12. Photo bast  tampilkan thumbnail hasil photonya,

13. Photo pelaksanaan  tampilkan thumbnail hasil photonya,

semua box photo wajib di isi dulu.

photo yang diupload ke Google Drive dikompres otomatis di bawah 200kb.

jika terkendala jaringan tidak stabil pastikan semua file photo aman tersimpan di penyimpanan Handphone dulu, pastikan semua photo terkirim semua ke Google Drive, jika status belum terkirim maka keterangan sementara statusnya draft tersimpan sehingga petugas bisa melakukan isian baru meski file belum di upload ke Google Drive,

namun status tidak boleh berubah menjadi terkirim apabila semua photo belum terkirim ke Google Drive.

14. tombol ambil koordinat sekarang,

15. tombol simpan di handphone, semua file tersimpan di handphone sehingga petugas dapat melakukan kirim nanti di tombol kirim semua di dashboard, setelah tombol simpan petugas kembali bisa melakukan isian baru, tampilkan dialog box status berhasil tersimpan.

16. Submit upload ke Google Drive, namun file tersimpan di handphone sebagai backup,tampilkan dialog box status berhasil terkirim, lalu tampilan kembali ke dashboard.

dashboard:

Menampilkan dan sembunyikan setup Google Drive di tampilan android kecuali jika dengan memasukan password "saintsalamunjcmo"

menampilkan status pengirim

no cpcl - nama cpcl - jika pelimpahan - waktu - alamat - koordinat yang langsung menjadi link ke google maps

status terkirim atau tersimpan atau pending

jika status belum terkirim tambahkan tombol kirim ulang untuk status yang pending, jangan hilang draft sampai status terkirim dan di terima oleh Google Drive.

Di Google Drive automatis membuat struktur folder: Nama Perusahaan > Nama Desa > [nomor cpcl] - [nama cpcl] - [jika pelimpahan], dan simpan photo tersebut didalamnya berikut semua data berupa txt .

Data text yang di upload ke Google Drive disimpan secara otomatis berupa xls dengan urutan waktu- nama perusahaan - nama desa - no cpcl - nama cpcl - pelimpahan - alamat cpcl - nik cpcl - no hp cpcl - koordinat - nama petugas- nomor petugas, tambahkan notifikasi suara jika data berhasil di upload ke Google Drive,

Jadikan upload ke Google Drive jalan otomatis di background, pakai Service Account agar tidak perlu login manual setiap kali. Nama ENV: SERVICE_ACCOUNT_JSON

saya ingin menambahkan dashboard owner per perusahaan, didalam dashboard ini owner harus memilih dulu perusahaannya yang tersedia lalu dapat melihat nama desa, jumlah cpcl , nama cpcl  data yang masuk dari petugas lapangan dari masing- perusahaan, berikan notifikasi suara jika ada data dari petugas yang masuk berupa suara wanita yang lucu menyebut "nama perusahaannya - masuk".  lalu di dashboard ini owner dapat mengunduh file excel masing-masing perusahaannya.

CATATAN PENTING UNTUK DEV:

Folder Google Drive utama bernama "Laporan Lapangan". Folder ini akan di sinkronkan ke PC Owner di direktori D:\Laporan Lapangan menggunakan Google Drive for Desktop mode Mirror. Jadi struktur folder harus rapi agar langsung muncul di HDD PC.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://geo-capture-drive.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e30659a5-cdbe-4625-bfc9-9f49337a47a7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
