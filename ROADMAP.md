# ROADMAP

## Tính năng tạm ẩn — phát triển sau

Các phần dưới đây đã được ẩn khỏi giao diện vì chưa có chức năng hoặc chỉ dành cho developer.

- **(a) Hệ thống thông báo (chuông):** nhận thông báo khi được giao task hoặc có comment, đánh dấu đã đọc. (Nút chuông trên `Header.tsx` đã bị gỡ.)
- **(b) Phím tắt bàn phím và bảng tra cứu phím tắt:** mục "Keyboard Shortcuts" trong menu hồ sơ (`SecondarySidebar.tsx`) đã bị gỡ.
- **(c) Các view sidebar chưa làm:** Dashboard, Roadmap, Issues/Tasks, Releases, Team Members, Settings. `SecondarySidebar.tsx` đang lọc bằng `VISIBLE_NAV_KEYS`.
- **(e) Badge trạng thái hệ thống:** nếu cần, chỉ hiện cho admin (trước đây là badge "Neon PG" trên header).
