# 產品庫存查詢（Supabase 共用資料版）

網頁支援登入後查詢、新增及變更產品名稱、代碼與庫存位置。資料存於 Supabase，登入的授權使用者可跨裝置共用。

## 1. 建立資料表及 RLS

在 Supabase 專案的 **SQL Editor → New query** 執行 `supabase-setup.sql`。此 SQL 建立 `products` 表，開啟 Row Level Security，並只允許已登入使用者讀取、新增及更新資料。它不提供刪除政策。

## 2. 設定網頁連線

在 Supabase 的 **Project Settings → API**（或 API Keys 頁面）複製 **Project URL** 及 **publishable key**；舊專案可使用 `anon` public key。打開 repo 的 `config.js`，將兩個 placeholder 換成這些值。這兩種公開前端 key 可放在網頁中，但必須搭配 RLS。**絕不可使用或公開 `service_role`／secret key。**

## 3. 建立登入帳號

網頁只提供登入，不開放訪客自行註冊。Supabase **Authentication → Users → Add user** 建立使用者（或以邀請方式新增），再用該 email 和密碼登入。只建立並授權可信任的使用者，因為已登入帳號都能讀取、建立及更新共用產品資料。若使用者忘記密碼，管理者可在 Supabase Authentication 管理使用者。

## 4. 發布

將變更推送到 GitHub Pages 使用的分支後，重新載入網站。GitHub Pages 的部署來源需設定為 `main` / `/(root)`。

## 注意

- `config.js` 只放 Project URL 和 publishable/anon key，該檔案會公開。不要放資料庫密碼或 secret key。
- 若產品名稱含 `%` 或 `_`，目前以 Supabase `ilike` 搜尋可能將它們視為萬用字元；一般產品名稱不受影響。
- 瀏覽器先前存在 `localStorage` 的資料不會自動匯入 Supabase。
