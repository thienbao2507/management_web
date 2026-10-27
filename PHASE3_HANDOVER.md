# Phase 3 — User Integration & Dynamic Workspace

Bàn giao source ngày 27/10/2026. Workspace `D:\myPro\Management_web`.

Đã triển khai source chặng 1–5 và kiểm thử cục bộ. **Hình sáu avatar chưa thể nghiệm thu vì thiếu asset. Production chưa chạy migration và chưa ghi dữ liệu thử.** Identity selection chỉ là preference của workspace; không phải đăng nhập hay bằng chứng xác minh danh tính.

## Baseline và phạm vi bảo toàn

- `main`, commit nền `828fb0b`. Các thay đổi Resources chưa commit và bản sửa Error/Empty State trong App đã có trước Phase 3 được giữ nguyên.
- Hash nguồn trước khi sửa: [baseline-hashes.json](artifacts/phase3/baseline-hashes.json). Các file thay đổi so với baseline đều thuộc những điểm tích hợp Phase 3 bên dưới; thư mục `.ai-workflow/` xuất hiện từ công việc khác được giữ nguyên, không sửa.
- Không chỉnh `.env`, `.neon`, DATABASE_URL, package/dependency, không tạo Neon project, commit, deploy, reset/clean/stash/checkout.
- `.neon` vẫn trỏ project `icy-star-25267600`, branch `production`. Database `neondb`, schema `public` vẫn ở `123263086b0a`.
- Source Resources revision `9b8a6d3f4e21` giữ nguyên; chỉ nối thêm hai revision. Source hiện có một head duy nhất: `a31f02c4d002`.
- Audit bằng transaction read-only xác nhận production giữ 3 project, 3 sprint, 4 task, 12 subtask; cả 4 task vẫn chưa có Sprint. Source mới đã GET đủ 4 task trên schema cũ trong transaction read-only: [bằng chứng](artifacts/phase3/production-readonly-audit.json). Không dùng health endpoint làm kiểm thử chức năng.

## Chặng 1 — User Data Foundation: hoàn thành source

Thêm `users` với id String(36), display_name, email nullable/unverified, job_title nullable, default_avatar_key, custom_avatar_url nullable, is_active, created_at/updated_at có timezone. Avatar key được tính ổn định từ UUID tại backend khi tạo rồi lưu; không phụ thuộc tên hoặc render.

Không có password, JWT, OAuth, session, auth provider hoặc `/me`. Không seed user khi migrate/startup. Email không được coi là đã xác minh hoặc dùng để tự ghép danh tính; job_title không phải role/quyền.

| API | Hợp đồng |
| --- | --- |
| `GET /api/v1/users` | `include_inactive=false`, `page>=1`, `page_size=1..200` (mặc định 100). `{items,total,page,page_size}`, sắp xếp display_name/id |
| `GET /api/v1/users/{id}` | User hiện tại theo ID, kể cả inactive; không tồn tại 404 |
| `POST /api/v1/users` | display_name bắt buộc; email/job_title/custom_avatar_url optional; trả 201. ID, avatar key và timestamp do backend gán |
| `PATCH /api/v1/users/{id}` | Chỉ sửa trường được gửi: display_name, email, job_title, custom_avatar_url, is_active |

Trim metadata, name 255/email 254/job title 150/URL 2048 ký tự; name null/rỗng bị từ chối; optional metadata có thể xóa bằng null. Email kiểm tra cấu trúc nhưng chưa xác minh. Avatar URL dùng HTTP(S), hostname hợp lệ, không embedded credentials hoặc tham số token/password thông dụng. Trường lạ như password/default_avatar_key/client id bị từ chối 422; key không cho PATCH tùy ý. created_at được giữ khi sửa, updated_at cập nhật. API mới trả 503 rõ ràng nếu schema chưa sẵn sàng.

## Chặng 2 — Current User và Shared Identity: hoàn thành source

- `UserProvider` là nguồn User chuẩn hóa theo id. Header, Sidebar, Profile dialog, Members, TaskCard/Drawer, deadline và My Tasks dùng nguồn này. Response User/members/tasks được đưa vào nguồn chung; response User cũ hơn không đè hồ sơ mới.
- Chọn profile active thật từ API hoặc nhập thông tin vào Create profile dialog. Không tự chọn người đầu tiên hoặc Alex; chưa chọn/ID không hợp lệ/inactive dùng trạng thái trung tính.
- Preference `management_web_user_id` được kiểm tra lại với dữ liệu API khi refresh. API lỗi không biến thành danh sách user rỗng giả hoặc quay lại danh tính demo.
- Project preference theo User: `management_web_project_id:{user_id}`. Chế độ trung tính giữ key cũ `management_web_project_id`. ID project được kiểm tra với danh sách project chưa archive trước khi khôi phục.
- Tái sử dụng menu/Dialog và ThemeContext, không dựng trang Profile/router/state framework mới. Edit profile cập nhật cùng nguồn User dùng ở các vị trí khác.
- LocalStorage/User ID không chứng minh người gọi đã đăng nhập. Các API không có authentication/authorization; membership validation không tạo bảo vệ đa người dùng.

## Chặng 3 — Unified Avatar: resolver hoàn thành, artwork BLOCKED

Đã kiểm tra lại: chưa có sáu asset/ảnh gốc được duyệt cho `owl`, `fish`, `cat`, `panda`, `hedgehog`, `robot` trong repository. Không tạo ảnh thay thế, không lấy Unsplash demo, không gán đường dẫn giả.

`UserAvatar` dùng `custom_avatar_url → approvedAvatarAssets[default_avatar_key] → initials`. Registry hiện để trống có chủ ý; chỉ đăng ký asset thật sau khi được cung cấp. Backend vẫn lưu một key ổn định trong sáu key đã duyệt; đổi tên không đổi key.

`Avatar` reset trạng thái lỗi theo User/src/fallback src; custom ảnh lỗi thử default nếu có, rồi initials. Giữ kích thước/CSS token cũ. Browser đã kiểm tra custom image ưu tiên, ảnh lỗi về initials và đổi User/src sau lỗi. Favicon có sẵn chỉ được dùng tạm làm input custom-image trong QA, rồi đã bỏ khỏi profile QA; không phải avatar chính thức. **Chưa PASS hình sáu default avatar hoặc nhánh hiển thị artwork approved chưa được cung cấp.** Không thêm upload/storage service.

## Chặng 4 — Membership và Task Assignee: hoàn thành source

Thêm `project_memberships(project_id,user_id,created_at)` với composite PK/FK và index theo user_id. Không thêm role/quyền khi chưa có nghiệp vụ phân quyền; job_title vẫn là thông tin hồ sơ.

Thêm `tasks.assignee_id` nullable String(36), FK tới users, index. Giữ nguyên mọi cột assignee legacy. Không backfill, tạo User từ Alex/Sarah/David, ghép theo tên hoặc thêm mọi User vào mọi Project.

| API | Hành vi |
| --- | --- |
| `GET /api/v1/projects/{id}/members` | Membership + User thật của project; archive/missing project 404; thiếu schema 503 |
| `POST /api/v1/projects/{id}/members` | `{user_id}` active/tồn tại; duplicate 409; không tự thêm ai khác |
| `DELETE /api/v1/projects/{id}/members/{user_id}` | Nếu còn task được giao, trả 409 và giữ nguyên mọi task/membership. Không có task thì chỉ xóa membership, giữ User |

Chính sách bảo toàn dữ liệu: không tự unassign/reassign khi xóa membership. Các task phải được người dùng giao lại rõ ràng trước; nếu muốn quy trình bulk khác cần quyết định riêng. Kiểm tra membership/assignment dùng lock trong transaction để tránh xung đột với thao tác xóa member.

Task POST/PATCH nhận assignee_id, kiểm tra User active và là member của đúng project. Client metadata không được dùng làm danh tính; gửi metadata giả cho task đã liên kết bị từ chối. Response có `assignee_id` và `assignee` User hiện tại để đưa vào nguồn chung.

Task chưa liên kết giữ metadata legacy làm fallback; My Tasks chỉ so sánh assignee_id với currentUser.id. Sửa description không tự xóa legacy assignment. Drawer mặc định Keep current assignment; chọn Unassigned là hành động rõ ràng, không phải backfill tự động.

Header avatar cluster/count, Team Members, CreateTaskModal và reassign trong Drawer lấy members thật của project. API lỗi/schema chưa sẵn sàng được hiển thị khác với zero membership; không dựng Empty State giả.

## Chặng 5 — Project/Sprint consistency: hoàn thành source

- `GET /api/v1/projects/{project_id}/sprints` trả tất cả Sprint thật của project active, thứ tự created_at/id.
- Default **All project tasks (includes unsprinted)** giữ toàn bộ task legacy nhìn thấy. Có lựa chọn Unsprinted / Backlog và từng Sprint. Không tự gắn 4 task cũ vào Sprint.
- Nhiều active Sprint được báo rõ và để người dùng chọn; không âm thầm chọn một cái. Sprint cụ thể gửi sprint_id khi GET/create task. Task PATCH cũng kiểm tra lại Sprint thuộc cùng project. `GET /tasks` thêm `unsprinted=true`; không kết hợp được với sprint_id.
- Reorder trong Sprint cụ thể gửi ngữ cảnh Sprint; backend không reorder các Sprint ẩn. Xóa task không reindex task của Sprint khác.
- `useProjectWorkspace` dùng AbortController và token riêng theo mỗi lần vào ngữ cảnh User/Project/Sprint. Mỗi lần A→B→A vẫn có token mới. Response cũ không cập nhật Tasks/members/Sprints hoặc User cache của ngữ cảnh mới.
- Task list/RightSidebar không sử dụng dữ liệu có token cũ. Drawer/modal đóng hoặc không render khi đổi ngữ cảnh. Callback create/update/delete/reorder, onClose và optimistic rollback kiểm tra token trước khi tác động UI.
- Giữ bản sửa Project Error/Empty State trước đó; bổ sung trạng thái lỗi Tasks/RightSidebar rõ ràng. Create Task chờ ngữ cảnh Tasks tải xong. Chọn project/identity khác reset hoặc kiểm tra lại ngữ cảnh Sprint.

Task reads/ordinary CRUD vẫn hoạt động trên schema cũ trong khi chờ migration. Cột assignee_id được defer và chỉ tải khi schema Phase 3 hoàn chỉnh; serializer không lazy-load cột còn thiếu. Insert trên schema cũ chủ động bỏ cột chưa tồn tại. Đây là compatibility code, không phải schema mutation/create_all.

## Migration và production gate

Chuỗi **toàn bộ pending**, phải được review/duyệt cụ thể:

```text
123263086b0a (Neon hiện tại)
  → 9b8a6d3f4e21 (Resources đang pending từ trước)
  → a31f01c4d001 (users)
  → a31f02c4d002 (project_memberships + tasks.assignee_id)
```

[SQL pending chain](artifacts/phase3/pending-chain.sql) bao gồm Resources một cách rõ ràng. [Rollback riêng Phase 3](artifacts/phase3/rollback-phase3.sql) về Resources revision; [rollback toàn pending chain](artifacts/phase3/rollback-full-chain.sql) về revision hiện có. Tất cả chỉ là preview offline.

Đã áp dụng **chỉ trên PostgreSQL 17 local**: database UUID tạm cho unit/migration tests và database QA chỉ định trong [qa-environment.json](artifacts/phase3/qa-environment.json). Unit DB được rollback/drop sau test; QA DB giữ để xem. Không tạo branch/project Neon hoặc thay context `.neon`. Không chạy upgrade head, stamp, sửa migration đã có, tạo nhánh Alembic hoặc migration lúc startup ứng dụng.

Ảnh hưởng và lock:

- Resources/users/memberships tạo bảng mới, không seed/backfill. `tasks.assignee_id` nullable, không default nên không cần rewrite dữ liệu cũ khi thêm cột.
- ALTER TABLE tasks cần ACCESS EXCLUSIVE ngắn; FK validation/index có thể đọc tasks và giữ lock cản ghi. Hiện có 4 task, nhưng vẫn phải audit lại trước khi áp dụng. FK memberships cũng cần lock ngắn trên projects/users.
- `lock_timeout='5s'` giới hạn chờ lock từng statement; migration nằm trong transaction. Tránh transaction dài và xem lock đang có trước khi chạy. Không dùng CREATE INDEX CONCURRENTLY trong transaction này.
- Index membership user_id phục vụ truy vấn/quan hệ theo User; assignee_id phục vụ truy vấn assignment và kiểm tra xóa member. Không thêm index email/role không có truy vấn yêu cầu.
- Alembic production phải dùng direct connection đã được xác nhận; endpoint Neon pooler bị guard từ phần Resources. Không đổi DATABASE_URL/.env trong tác vụ này. Thêm khả năng inject connection vào Alembic để test local mà không override môi trường production.

Trước khi áp dụng production sau xác nhận riêng: audit lại revision/schema/counts/lock, đối chiếu SQL toàn chain và direct connection đúng project/branch/database/schema; chạy đúng target revision được duyệt, không dùng head tùy ý. Nếu head/schema đã đổi thì dừng để kiểm tra lại chuỗi, không stamp bỏ qua Resources.

Sau migration: revision đúng target; đủ bảng/index/FK; projects/sprints/tasks/subtasks giữ count 3/3/4/12; 4 task vẫn sprint_id NULL và assignee_id NULL; users/memberships không được seed; các API trả đúng empty/metadata và Active Sprint mặc định còn 4 task. **Ghi User/project QA trên production vẫn cần xác nhận riêng, không được suy ra chỉ từ xác nhận migration.**

Rollback Phase 3 làm mất hồ sơ User mới, memberships và mapping assignee_id; giữ task và các cột legacy/Sprint. Phải export users/memberships/task-id→assignee-id trước nếu có dữ liệu mới. Rollback toàn chain còn xóa Resources mới. Không tự rollback production; ưu tiên sửa code/roll forward nếu dữ liệu mới đã được dùng.

## Kiểm thử thực chạy

Môi trường: Conda env_310, Python 3.10.19, PostgreSQL 17 local, FastAPI/SQLAlchemy/Pydantic hiện hữu; Chromium qua Playwright. QA backend 8002 dùng dependency override tới DB local; Vite 6008 proxy tới backend này. Không override DATABASE_URL hoặc chỉnh .env. Các profile QA là fixture trong test, không phải seed của ứng dụng hoặc người dùng thật trong production.

| Kiểm thử | Trạng thái | Bằng chứng/phạm vi |
| --- | --- | --- |
| User validation, persistence, PATCH omission/null, inactive, default avatar ổn định | PASS | Unit/API local |
| Members đúng Project, duplicate, User inactive/ngoài project, removal 409 giữ task | PASS | Unit/API local |
| Sprint sai Project, unsprinted, giữ metadata legacy, reorder, không reindex Sprint ẩn | PASS | Unit/API local |
| Project/Task/Subtask CRUD và Resources regression | PASS | Unit/API local |
| Schema cũ → Resources → User → memberships; rollback giữ task, chưa schema báo 503 | PASS | Database local tạm, Alembic check không lệch model/schema |
| Tổng backend suite mới | PASS — 15 tests | [JUnit](artifacts/phase3/backend-tests.xml) |
| Chọn/tạo/sửa identity bằng UI; refresh; project preference theo User; tên chung | PASS | [Identity results](artifacts/phase3/identity-results.json), 9 nhóm kiểm tra |
| Custom image ưu tiên/lỗi/đổi src-User sau lỗi; cùng resolver các vị trí | PASS cho cơ chế | Custom fixture có sẵn; approved default artwork chưa có |
| My Tasks không nhận task legacy chỉ vì trùng tên User; members/Sprint/create đúng ID | PASS | Browser + API thật local |
| Đổi project A→B, response trả đảo thứ tự | PASS | Response A delay, Tasks và RightSidebar B không bị ghi đè |
| Pending create/update/delete/reorder, modal/Drawer B và optimistic rollback | PASS | Real local API + delay/failure có chủ đích |
| Project Error không thành Empty giả, User schema lỗi trung tính, membership lỗi khác zero members | PASS | Browser fixture lỗi HTTP + retry thực |
| Saved User ID sai/inactive bị loại, không auto chọn người khác | PASS | Browser + API local |
| Tổng browser consistency | PASS — 11 nhóm | [Consistency results](artifacts/phase3/consistency-results.json) |
| Light/Dark + mobile 390/320 px, Profile/Members | PASS | Screenshot đã mở kiểm tra; board giữ horizontal scroll thiết kế cũ |
| TypeScript + production build | PASS | `npm --prefix frontend run build`; còn cảnh báo JS bundle >500 kB |
| Lint hiện tại | PASS exit 0, còn warnings | `npm --prefix frontend run lint`; lỗi hooks TaskDetailDrawer trước đó đã sửa khi tích hợp |
| Source mới đọc 4 task legacy trực tiếp Neon/schema cũ | PASS read-only | Transaction read_only=on; không thay thế nghiệm thu ghi dữ liệu |
| Migration/User/Membership CRUD ghi dữ liệu trên Neon production | BLOCKED/chưa chạy | Chờ xác nhận riêng đúng hành động |
| Hình owl/fish/cat/panda/hedgehog/robot | BLOCKED | Thiếu asset/ảnh gốc; không tạo thay thế |

Các lỗi selector của harness trong lúc phát triển đã được sửa và chạy lại; chỉ kết quả cuối PASS được dùng ở đây. Không chạy suite Phase 2 cũ có thể ghi thẳng Neon.

## Screenshots

- [Workspace Light](artifacts/phase3/workspace-light.png), [Workspace Dark](artifacts/phase3/workspace-dark.png).
- [Members Dark](artifacts/phase3/members-dark.png), [Profile Dark](artifacts/phase3/profile-dark.png).
- [Mobile Light](artifacts/phase3/mobile-light.png), [Mobile Dark](artifacts/phase3/mobile-dark.png), [Profile 320 px](artifacts/phase3/profile-mobile-320.png).

## File Phase 3

Thêm backend:

- `app/models/user.py`, `app/models/project_membership.py`.
- `app/schemas/user.py`.
- `app/api/v1/users.py`, `app/api/v1/project_workspace.py`.
- `alembic/versions/a31f01c4d001_add_users.py`.
- `alembic/versions/a31f02c4d002_add_memberships_assignee.py`.

Sửa backend: `app/models/__init__.py`, `app/models/task.py`, `app/schemas/task.py`, `app/api/v1/tasks.py`, `app/main.py`, `alembic/env.py`.

Thêm frontend:

- `src/context/UserContext.tsx`, `src/context/useProjectWorkspace.ts`.
- `src/components/ui/UserAvatar.tsx`.
- `src/components/identity/IdentityDialog.tsx`, `src/components/identity/TaskIdentity.tsx`.
- `src/components/project/ProjectMembers.tsx`.

Sửa frontend: `src/App.tsx`, `src/services/api.ts`, `src/components/ui/Avatar.tsx`, các `layout/{Header,PrimarySidebar,SecondarySidebar,RightSidebar}.tsx`, các `kanban/{CreateTaskModal,TaskCard,TaskDetailDrawer,KanbanBoard}.tsx`.

Thêm tests/harness trong `backend/tests/phase3/`: conftest, test_users, test_workspace, test_staged_migrations, serve_qa, browser_identity, browser_consistency, screenshots, preview, audit_readonly. Artifacts trong `artifacts/phase3/`; báo cáo này là `PHASE3_HANDOVER.md`.

Các file Resources/config/Vite đang dirty từ tác vụ trước không phải thay đổi Phase 3, trừ các điểm tích hợp chung đã liệt kê. Không thêm dependency.

## Chạy và nghiệm thu cục bộ

Runtime thông thường (không chạy migration khi startup):

```powershell
cd D:\myPro\Management_web\backend
conda activate env_310
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal khác ở workspace: `npm --prefix frontend run dev`, mở `http://localhost:6006`. Khi schema production chưa sẵn sàng, User integration báo 503/trung tính; legacy Tasks vẫn đọc/CRUD bình thường. Không cần sửa .env để chạy source.

Preview QA hiện có: `http://127.0.0.1:6008/#/active-sprint`, backend 8002, database local UUID trong qa-environment.json. Giữ lại 2 profile QA, 2 project QA, 3 Sprint, 3 Task, 1 membership để xem; ID trong identity-results.json. Không coi các fixture này là demo users của ứng dụng hay người thật. Unit DB tạm đã được dọn; browser chỉ xóa/đổi các record tự tạo trong DB riêng. Database Resources QA từ tác vụ trước không bị dọn hoặc sửa.

Tái chạy unit tests (cần cluster local 127.0.0.1:55432 đang chạy, user test resources_test):

```powershell
cd D:\myPro\Management_web\backend
conda activate env_310
python -m pytest tests/phase3 -q
```

Fixture tự tạo database local UUID, inject connection, rồi dọn đúng database đó; không dùng engine production cho ghi test. Không set DATABASE_URL.

QA server: `python tests/phase3/serve_qa.py` tái sử dụng DB QA hiện có, không migrate khi serve. Chỉ khi chủ động muốn database QA mới mới dùng `--setup`: tạo DB local mới và áp từng revision rõ ràng. Vite QA dùng `$env:API_PROXY_TARGET='http://127.0.0.1:8002'` rồi `npm --prefix frontend run dev -- --host 127.0.0.1 --port 6008` từ workspace. Thứ tự test browser: `browser_identity.py`, `browser_consistency.py`, `screenshots.py`.

Sinh SQL không kết nối DB: `python tests/phase3/preview.py`. Audit production read-only: `python tests/phase3/audit_readonly.py` — chỉ counts/schema/GET task trong transaction read-only, không in thông tin kết nối bí mật.

## Việc còn cần đầu vào/quyết định

- Cung cấp sáu artwork avatar được duyệt để đăng ký và nghiệm thu hình; hiện fallback initials.
- Xác nhận riêng migration **toàn pending chain có Resources** hoặc chỉ prefix cụ thể. Chưa có xác nhận nào được dùng để chạy production.
- Xác nhận riêng nếu muốn tạo User/project/dữ liệu QA trên production để nghiệm thu.
- Mapping các tên assignee legacy sang User ID thật và gắn 4 task cũ vào Sprint nào: chưa tự quyết định hoặc thay dữ liệu. Có thể dùng reassign Task rõ ràng từng bản ghi sau khi User/membership thật đã có.
- Nếu muốn xóa member còn task bằng quy trình khác thay vì 409, cần chọn quy trình reassign/unassign cụ thể. Hiện giữ nguyên dữ liệu.
- Identity selection chưa có authentication/access control. Membership/filter không bảo vệ dữ liệu theo người đăng nhập; không tuyên bố hỗ trợ multi-user security.
- Chưa kiểm thử Safari/Firefox/mobile vật lý; đã chạy Chromium ở desktop/mobile viewport. Lint còn warnings và build còn cảnh báo bundle size, không mở rộng refactor toàn app để xử lý chúng.
