# ReAct Lab — demo trên localhost

Giao diện xem 22 case bài chính cùng trace đã lưu. Không chạy agent, không gọi model/API, không đọc `.env`, không cần cài thêm package. Dùng Python 3.10+ và trình duyệt.

## Mở trên Windows

Nhấp đúp **`start_demo.cmd`** ở thư mục gốc repository. File này gọi `start_demo.ps1`, ưu tiên Python trong `.venv`, chạy server nền với cửa sổ ẩn, rồi mở trình duyệt. PowerShell launcher không thay đổi execution policy của hệ thống.

Nếu muốn chạy trực tiếp từ PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start_demo.ps1
```

Mặc định dùng cổng 8000. Nếu cổng bận, launcher tìm cổng trống tiếp theo trong 8001–8010. Nếu viewer của chính repo đã chạy ở một trong các cổng đó, mở lại viewer có sẵn. Log server nằm trong `demo_ui/logs/` và được Git bỏ qua.

Hoặc chạy server trong terminal để dễ dừng bằng Ctrl+C:

```bash
python demo_ui/server.py
```

Sau đó mở `http://localhost:8000`. Có thể chọn cổng khác bằng `--port 8001`.

## Trình chiếu trước lớp

- Launcher mở **chế độ trình chiếu** và chọn H6. Mặc định chế độ này ẩn hướng dẫn, đáp án kỳ vọng và bảng chấm; chỉ trình bày case, trace và câu trả lời. Dòng “Trace đã lưu” vẫn thể hiện đúng đây là kết quả được ghi từ trước.
- Bấm **Toàn màn hình** hoặc F11 để ẩn thanh trình duyệt. Server không có cửa sổ console riêng. Đóng hoặc thu nhỏ các ứng dụng khác trước khi chia sẻ toàn màn hình máy tính.
- Bấm một case bên trái để xem trace của case đó. Chọn phiên bản để so sánh cùng một câu hỏi qua các lần chạy; điểm chênh lệch so với baseline nằm cạnh điểm case.
- Nút **Từng lượt** mở dần từng lượt model; **Hiện tất cả** trả lại toàn bộ trace. Đây là phát lại dữ liệu đã ghi, không phải gọi lại model.
- Mỗi tool card có arguments, tóm tắt kết quả và mục mở JSON đầy đủ; không bỏ dữ liệu nhiễu khỏi JSON gốc. Nút JSON đổi sang trace nguyên bản, có thể sao chép.
- Bấm **Chế độ đầy đủ** để xem nhận xét judge và đáp án kỳ vọng. Mục **Hiểu bài lab để trình bày** chứa bài toán, hai tools, khái niệm snapshot và kịch bản demo 3–5 phút; nội dung chỉ xuất hiện khi bạn chủ động mở mục đó. Bấm **Trình chiếu** để ẩn lại.

Bạn có thể mở URL `http://localhost:8000/?present=0#H6` để đọc hướng dẫn trước buổi demo; chế độ trình chiếu là `?present=1`.

## Dữ liệu

- Danh sách câu hỏi/đáp án kỳ vọng: `evals/cases.json`.
- Kết quả: `eval_before.json`, `eval_after.json` và `eval_after_vN.json` ngay ở thư mục repo. Mặc định chọn phiên bản có số lớn nhất; khi hai file sau cải tiến trùng hoàn toàn thì không lặp bản nộp trong danh sách.
- Một case chưa có trong file đang chọn sẽ được đánh dấu thiếu kết quả, không được hiển thị như đã đạt.
- Bấm **Tải lại file** sau khi một lần eval đã ghi xong. UI tự nạp bản báo cáo mới; không chỉnh sửa bất kỳ kết quả nào.
- Server chỉ lắng nghe `127.0.0.1`, chỉ phục vụ các assets của viewer, danh sách đề và các file report đúng mẫu tên. Không dùng server này để truy cập `.env` hoặc file tùy ý trong repo.

## Dừng server nền

PID được ghi vào `demo_ui/logs/server.pid` khi launcher khởi động một server. Có thể xem tiến trình tương ứng trong Task Manager và kết thúc đúng tiến trình Python chạy `demo_ui/server.py`. Nếu dùng lệnh chạy server trực tiếp trong terminal, nhấn Ctrl+C ở terminal đó.

## Phạm vi xác minh

Các file viewer và launcher được tạo theo yêu cầu; chưa khởi động server, chạy thử UI, chạy test hoặc gọi API trong lúc tạo, theo yêu cầu không tự chạy của người dùng. Kết quả unit tests/eval trong các file bài lab là bằng chứng cho agent; không phải bằng chứng kiểm thử UI này.
