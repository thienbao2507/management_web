# Project Resources — bàn giao triển khai

Ngày kiểm thử: 26/10/2026. Workspace `D:\myPro\Management_web`.

Module đã triển khai và kiểm thử trên PostgreSQL cục bộ riêng. **Neon production chưa chạy migration và chưa ghi dữ liệu kiểm thử.** Bước còn chờ là xác nhận riêng cho migration `123263086b0a → 9b8a6d3f4e21`, sau đó mới nghiệm thu trực tiếp trên Neon.

## Chức năng

- Thay Reports bằng Resources đúng vị trí của Workspace Views và shortcut PrimarySidebar, dùng Lucide LibraryBig; đồng bộ desktop/mobile.
- `/#/resources`, khởi tạo từ hash, reload/back/forward, quay lại `/#/active-sprint`.
- Project Resources / All your project links, in one place. Header chuyển breadcrumb/search/action đúng ngữ cảnh; ẩn panel task khi ở Resources.
- Mặc định tìm toàn bộ project chưa archive. Bộ lọc Project là lựa chọn rõ ràng, không tự áp dụng project Sidebar. Sidebar chỉ gợi ý project lúc thêm.
- Search debounce 300 ms, backend/database xử lý tìm kiếm; Project/type/ngày, total và phân trang. Hủy request và kiểm tra sequence chống response cũ.
- Nhóm danh sách theo Project ID, hiển thị tên project/type/icon/description/tags/ngày tạo/Open Link/actions.
- Add/Edit có project API thật, tám loại resource, keyword Enter/xóa, gom keyword đang nhập khi Save; pending và khóa submit trùng. Lỗi lưu giữ nguyên form/dữ liệu.
- Detail Drawer có metadata, URL đầy đủ, thời điểm tạo/sửa đến giây; dialog xóa nêu tên và phạm vi xóa. Toast theo kết quả API.
- Loading/empty/no-results/error/retry, reset lọc, cập nhật total/trang sau CRUD, Light/Dark/System, mobile 390 px và 320 px.
- URL được kiểm tra cả client/server: HTTP(S), hostname hợp lệ, không sửa URL để đoán địa chỉ khác. Chặn scheme khác, credentials, và tham số token/password thông dụng. Link mở đúng giá trị đã lưu với `_blank` + `noopener noreferrer`; không tải/nhúng/đọc tài liệu bên ngoài.

## Database và API

Bảng mới `project_resources`: `id VARCHAR(36)` cùng kiểu Project; `project_id` bắt buộc FK projects; title/url/type bắt buộc; description; `keywords TEXT[] NOT NULL DEFAULT '{}'`; `created_at`/`updated_at TIMESTAMPTZ NOT NULL`. Không có giới hạn số resource cho một project. Xóa resource chỉ xóa bản ghi đó. Project archive giữ dữ liệu resource nhưng ẩn khỏi toàn bộ CRUD/list/total. FK cascade chỉ áp dụng khi xóa cứng project; API project hiện tại dùng archive.

Timestamp trả về API dưới UTC (`Z`). Ngày lọc và ngày hiển thị dùng `Asia/Ho_Chi_Minh` (UTC+7). Khoảng ngày `[00:00 ngày bắt đầu, 00:00 ngày sau ngày kết thúc)`, đổi sang UTC trước khi query. PATCH bỏ qua trường không gửi, giữ created_at, đổi updated_at khi có cập nhật.

Tìm kiếm dùng built-in PostgreSQL `normalize()` + `lower()` + `translate()` cho tiếng Việt, kể cả Unicode tách dấu và Đ/đ. JOIN tên project hiện tại nên đổi tên có hiệu lực ngay. `%`, `_`, `\` trong q được escape để tìm literal. Không cài extension. Thứ tự `created_at DESC, id DESC` cố định.

| API | Công dụng |
| --- | --- |
| `GET /api/v1/resources` | Danh sách và total |
| `GET /api/v1/resources/{id}` | Một resource |
| `POST /api/v1/resources` | Tạo, trả 201 |
| `PATCH /api/v1/resources/{id}` | Cập nhật các trường đã gửi |
| `DELETE /api/v1/resources/{id}` | Xóa đúng một resource |

Query list kết hợp: `q` (tối đa 200 ký tự), `project_id`, `resource_type`, `created_from`, `created_to` (YYYY-MM-DD), `page` (1–100000), `page_size` (1–100, mặc định 20; UI dùng 12). Response `{items,total,page,page_size,pages}`. Unknown resource/project hoặc project archive trả 404; input sai trả 422. Khi chưa có migration, Resources trả 503 có thông báo rõ ràng; đã kiểm thử API Projects vẫn hoạt động trên schema cũ.

Payload POST: `project_id`, `title`, `url`, `resource_type`, `description?`, `keywords?`. PATCH dùng cùng các trường nhưng chỉ gửi trường cần thay đổi. Required fields từ chối null/rỗng; giới hạn title 255, URL 2048, description 2000, tối đa 20 keywords × 50 ký tự; trim và khử tag rỗng/trùng không phân biệt hoa/thường. Không nhận trường lạ như created_at.

Loại hỗ trợ: Website, Google Docs, Google Sheets, Google Drive, Canva, Word, GitHub, Other.

Nền tảng hiện chưa có authentication/project membership. Module giữ phạm vi project active của API hiện có; không thêm hệ thống auth. Frontend chỉ gọi API, không chứa kết nối Neon.

## Migration production cần xác nhận riêng

Revision mới: [9b8a6d3f4e21](backend/alembic/versions/9b8a6d3f4e21_add_project_resources.py), nối head `123263086b0a`; migration Phase 2 không bị sửa.

Đã áp dụng ở local cluster PostgreSQL 17, `127.0.0.1:55432`, database `management_resources_test`. Một database local tạm khác được tạo riêng để kiểm tra upgrade/downgrade/upgrade rồi đã xóa. Không áp dụng ở Neon hay branch khác.

Schema production được audit bằng transaction read-only: `neondb`, PostgreSQL 18.6, UTF8, GMT, revision `123263086b0a`; có projects/sprints/tasks/subtasks/alembic_version, không có project_resources; counts 3/3/4/12. Bản baseline/hash ở [baseline.md](artifacts/project-resources/baseline.md).

Audit lần cuối `2026-10-26T08:22:55Z` vẫn giữ revision/counts này: [kết quả read-only](artifacts/project-resources/production-readonly-audit.json).

SQL cụ thể: [upgrade preview](artifacts/project-resources/migration-preview.sql), [rollback preview](artifacts/project-resources/rollback-preview.sql).

Ảnh hưởng:

- Chỉ tạo bảng mới, check constraint/FK và ba index; đổi alembic_version sau thành công. Không backfill, sửa, xóa hay rewrite bảng hiện có, không extension.
- Index `(created_at)` phục vụ thư viện toàn cục/ngày; `(project_id, created_at)` phục vụ filter Project và FK; `(resource_type, created_at)` phục vụ type/ngày. Không thêm GIN/trigram hoặc index metadata chưa có truy vấn dùng đến.
- Bảng mới rỗng nên tạo index không quét dữ liệu cũ. Tạo FK cần lock ngắn trên projects; có thể phải chờ hoặc tạm chặn ghi đồng thời. `SET LOCAL lock_timeout='5s'` giới hạn chờ lock, lỗi sẽ rollback transaction. Tránh thời điểm có transaction ghi dài.
- Dùng direct connection qua `DATABASE_URL_UNPOOLED`. Alembic online từ chối endpoint Neon pooler. Không tự migration khi startup, không dùng create_all.
- Rollback revision này xóa riêng bảng Resources và toàn bộ resource đã tạo; giữ projects/sprints/tasks/subtasks. Nếu bảng đã có dữ liệu, phải export/backup Resources trước; ưu tiên giữ bảng và sửa code nếu không cần bỏ schema. Không tự rollback production.

Sau xác nhận, trình tự vận hành: audit read-only lại schema/head → xác nhận direct connection đúng database/schema/branch → chạy `python -m alembic upgrade 9b8a6d3f4e21` trong backend → kiểm tra revision/schema → tạo project QA riêng để nghiệm thu trên Neon. Nếu production head thay đổi trong lúc chờ, phải kiểm tra và rebase revision trước khi chạy. File SQL là preview review; Alembic là cách áp dụng chính thức.

**Yêu cầu phê duyệt cụ thể:** cho phép áp dụng revision `9b8a6d3f4e21` trên Neon project `icy-star-25267600`, branch `production`, database `neondb`, schema `public` theo preview ở trên. Xác nhận phương án “oki” và các yêu cầu “tiếp tục” trước đó chưa được dùng làm xác nhận migration này.

## Kết quả kiểm thử thực tế

Môi trường: Windows, Conda `env_310`, Python 3.10.19, FastAPI 0.115.0, SQLAlchemy 2.0.54, Pydantic 2.13.5, Alembic 1.20.0, PostgreSQL 17 local. Browser: Chromium riêng qua Playwright 1.60.0; Vite `127.0.0.1:6007` → FastAPI `127.0.0.1:8001`. Các request bên ngoài đều bị chặn trong bộ test browser; Open Link vẫn kiểm tra URL/tab bằng navigation bị chặn, không đọc nội dung tài liệu.

| Bài kiểm thử | Kết quả | Bằng chứng/phạm vi |
| --- | --- | --- |
| Backend validation/API/search/date/archive + migration roundtrip | PASS, 51 tests | [JUnit](artifacts/project-resources/backend-tests.xml), local DB riêng |
| Docs/Sheets/Canva tạo và xác nhận SQL | PASS local | API thật + truy vấn PostgreSQL |
| Search project/technical/hoa thường/Việt có-không dấu/Đ-đ/NFD, tên project sau rename | PASS local | Test backend và browser |
| Type/project/ngày kết hợp, trọn ngày cuối, invalid dates/type/pagination | PASS local | Boundary UTC+7 và backend 422 |
| Edit URL/description/keywords, created_at giữ nguyên, updated_at thay đổi, refresh | PASS local | API, SQL, browser |
| Delete riêng resource; project/resource còn lại vẫn tồn tại | PASS local | API, SQL, browser |
| URL nguy hiểm/hostname/credentials/token bị từ chối | PASS | Backend tests; browser javascript rejection |
| Form lỗi giữ dữ liệu + pending keyword + retry + chống submit trùng | PASS | Browser với lỗi/delay được chủ động mô phỏng |
| Open Link tab mới, URL chính xác, rel | PASS | Browser; không fetch tài liệu ngoài |
| List loading/error/retry; empty/no-results | PASS | UI fixture rõ ràng cho global empty, lỗi mạng chủ động mô phỏng; query no-results thực |
| Phân trang/total/xóa bản ghi cuối trang/sửa ra ngoài bộ lọc | PASS | Browser + API thật |
| Response tìm kiếm cũ đến trễ | PASS | Response cũ delay 800 ms, kết quả mới được giữ |
| Hash navigation/reload/back/forward/Primary shortcut/mobile menu | PASS | Browser |
| Light/Dark/System và đổi OS color scheme | PASS | Browser và screenshot đã mở kiểm tra |
| Desktop1440, mobile390, mobile320, form/drawer/keyboard | PASS | Browser, không tràn ngang, Escape đóng modal |
| Active Sprint/Task CRUD/reload/Kanban keyboard drag sang Done | PASS local | Project QA riêng, kiểm tra reorder API và persistence |
| Restart backend + Vite, browser context mới/reload, SQL/API persistence | PASS local | [Restart results](artifacts/project-resources/restart-results.json) |
| Frontend production build | PASS | `npm --prefix frontend run build` (còn cảnh báo bundle >500 kB) |
| Scoped lint các file Resources/tích hợp | PASS exit 0 | Còn warnings set-state-in-effect |
| Lint toàn repo | FAIL do lỗi có sẵn | 14 rules-of-hooks trong TaskDetailDrawer của Phase 2; file đó không sửa |
| Migration/CRUD/search/persistence trực tiếp Neon | CHƯA CHẠY — BỊ CHẶN | Chờ xác nhận riêng production migration |

Báo cáo browser chi tiết: [main](artifacts/project-resources/browser-results.json), [regression](artifacts/project-resources/regression-results.json), [restart](artifacts/project-resources/restart-results.json). Những lần lỗi trong quá trình viết test harness đã được sửa và chạy lại; không dùng kết quả health endpoint thay kiểm thử chức năng.

## Screenshot đã mở kiểm tra

- [Desktop Light](artifacts/project-resources/desktop-light.png), [Desktop Dark](artifacts/project-resources/desktop-dark.png).
- [Mobile Light](artifacts/project-resources/mobile-light.png), [Mobile Dark](artifacts/project-resources/mobile-dark.png).
- [Mobile form Dark](artifacts/project-resources/mobile-form-dark.png), [Detail Drawer 320 px](artifacts/project-resources/mobile-detail-320.png).

## Dữ liệu kiểm thử và tiến trình còn giữ

Không tạo/sửa/xóa project hay Active Sprint hiện hữu trên Neon. Local hiện giữ **2 project, 3 resources (Docs, Sheets, Canva)** để xem lại giao diện; ID chính xác trong browser-results.json. Project QA phụ của regression và toàn bộ bản ghi con đã được dọn theo đúng ID do script tạo; unit tests cũng chỉ dọn project do fixture tạo. Database roundtrip tạm đã xóa. Hai screenshot lỗi của các lần viết harness đã xóa, ảnh nghiệm thu cuối vẫn giữ.

Local cluster ở `%TEMP%\management-resources-pg-20261026`, port 55432, user test `resources_test`, database `management_resources_test`. Backend test 8001 và frontend test 6007 đã restart, đang giữ để nghiệm thu tại `http://127.0.0.1:6007/#/resources`. `.env`, `.neon`, server frontend cũ 6006 và PostgreSQL cũ 5432 không bị đổi context hay dừng.

## Hướng dẫn chạy

Với kết nối hiện tại, chỉ chạy production migration sau xác nhận riêng. `backend/.env` giữ cấu hình kết nối; không đưa URL/token vào source/log. Runtime dùng `DATABASE_URL`, migration dùng `DATABASE_URL_UNPOOLED` direct. Fallback credential hard-code cũ đã bỏ khỏi config; credential từng được commit trước đây nên cần rotate bởi chủ tài khoản, không rewrite lịch sử Git trong tác vụ này.

Backend (terminal 1):

```powershell
cd D:\myPro\Management_web
conda activate env_310
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend (terminal 2):

```powershell
cd D:\myPro\Management_web
npm --prefix frontend run dev
```

Mở `http://localhost:6006/#/resources`. Khi chưa có migration, API Resources trả 503; các API Projects/Tasks vẫn chạy. Có thể dùng start-backend.bat/start-all.bat hiện hữu trong terminal đã có Conda.

Tái chạy bộ kiểm thử an toàn trên **local test DB đã được tạo ở trên**, không dùng DATABASE_URL production:

```powershell
cd D:\myPro\Management_web\backend
conda activate env_310
$env:TEST_RESOURCES_DATABASE_URL='postgresql://resources_test@127.0.0.1:55432/management_resources_test'
$env:DATABASE_URL=$env:TEST_RESOURCES_DATABASE_URL
$env:DATABASE_URL_UNPOOLED=$env:TEST_RESOURCES_DATABASE_URL
python -m pytest tests/test_resources.py tests/test_resources_migration.py -q
```

Browser suite cần backend 8001 dùng local DB ở trên và Vite 6007 với `$env:API_PROXY_TARGET='http://127.0.0.1:8001'` trước `npm --prefix frontend run dev -- --host 127.0.0.1 --port 6007`. Thứ tự scripts: `resources_browser_check.py`, `resources_browser_regression.py`; restart services rồi `resources_restart_check.py`. Không chạy mù test_api.py/verify_neon_e2e.py/capture_phase2*.py vì chúng dùng cấu hình DB hiện hành để ghi dữ liệu.

Audit production an toàn: trong terminal mới không có biến override local, `python tests/resources_readonly_audit.py`. Script đặt transaction read-only, chỉ trả schema/revision/counts và không in thông tin kết nối bí mật.

## File thay đổi

Backend thêm:

- `backend/app/models/project_resource.py`
- `backend/app/schemas/project_resource.py`
- `backend/app/api/v1/resources.py`
- `backend/alembic/versions/9b8a6d3f4e21_add_project_resources.py`
- `backend/tests/test_resources.py`
- `backend/tests/test_resources_migration.py`
- `backend/tests/resources_browser_check.py`
- `backend/tests/resources_browser_regression.py`
- `backend/tests/resources_restart_check.py`
- `backend/tests/resources_readonly_audit.py`

Backend cập nhật: `app/models/__init__.py`, `app/models/project.py`, `app/main.py`, `app/core/config.py`, `alembic/env.py`.

Frontend thêm: `components/resources/ResourcePage.tsx`, `ResourceFormDialog.tsx`, `ResourceDetailDrawer.tsx`, `resourceUtils.tsx`.

Frontend cập nhật: `src/App.tsx`, `src/services/api.ts`, `src/components/layout/{PrimarySidebar,SecondarySidebar,Header}.tsx`, `vite.config.ts`. Vite thêm override proxy cho môi trường test riêng; mặc định vẫn backend 8000. App chỉ mount TaskDetailDrawer khi có task để tránh thay đổi số hooks khi null; không sửa file component Phase 2 đó. Badge project key dài được truncate để không chồng tên project.

Artifacts: thư mục `artifacts/project-resources/` chứa baseline, SQL preview/rollback, kết quả test và screenshots. Báo cáo này: `PROJECT_RESOURCES_HANDOVER.md`.

## Giới hạn còn lại

- Production migration và nghiệm thu ghi dữ liệu trực tiếp Neon đang chờ đúng xác nhận riêng theo yêu cầu.
- Chưa có authentication ở nền tảng hiện hữu; không tuyên bố đã có project access control theo người dùng.
- Lint toàn repo vẫn có lỗi hooks Phase 2 kể trên. Browser CRUD/drag regression đã PASS với cách mount tại App.
- Build còn cảnh báo bundle >500 kB. Không mở rộng sang refactor toàn ứng dụng.
- Tìm kiếm literal substring Unicode hiện không có trigram index; với dữ liệu rất lớn cần đo truy vấn trước khi bổ sung index/extension.
- Chưa kiểm thử riêng Safari/Firefox hay thiết bị mobile vật lý; responsive đã chạy Chromium ở viewport thực 1440/390/320.
- Không upload file, lưu binary, đồng bộ/đọc Drive, tự fetch metadata, AI search hay kiểm tra link hỏng.
