# Ghi chú phân tích · Day 04

Họ và tên: Chu Nguyễn Tùng Dương

MSSV: 2A202604016

## 1. Case được chọn

- **Case chính: H6 — điều tra nhiều bước và dữ liệu nhiễu.**
- **Câu hỏi:** “Xem status GitHub Actions, tìm incident h02n9572mx9y và theo liên kết của nó. Incident gộp có nêu nguyên nhân hay chỉ mô tả ảnh hưởng? Nêu giới hạn dữ liệu và trích nguồn.”
- **Điểm trước cải tiến:** 95/100, trong `eval_before.json`.
- **Câu trả lời trước cải tiến:** agent đọc đúng incident ban đầu, theo liên kết sang `xr3myzj7ms51`, trình bày nguyên nhân và ảnh hưởng, dẫn nguồn và nêu phần cập nhật bị cắt. Tuy nhiên, chưa trả lời rõ phần trạng thái GitHub/Actions trong snapshot.

Trích câu trả lời ban đầu:

> **Kết luận:** Incident gộp **có nêu nguyên nhân**, không chỉ mô tả ảnh hưởng.
>
> Incident `h02n9572mx9y` (“Incident with Actions”) hiện **đã resolved**. Cập nhật cuối của incident này hướng người đọc sang incident gộp `xr3myzj7ms51`.

`resolved` là trạng thái của incident lịch sử, không thay thế câu trả lời về trạng thái dịch vụ. Nhận xét của judge cũng chỉ ra agent chưa nói rõ trạng thái tổng thể GitHub là “All Systems Operational”. Tôi chọn H6 vì có thể đối chiếu thiếu sót trực tiếp giữa câu hỏi, tool result và final answer, thay vì chỉ dựa vào điểm số.

Phạm vi so sánh chính trong ghi chú này là `eval_before.json` với `eval_after.json`. File sau đã được chép nguyên từ `eval_after_v7.json`; hai file có cùng SHA-256. Các phiên bản v2–v6 là các thử nghiệm trung gian, được phân biệt rõ ở mục 4.

## 2. Bằng chứng trong trace

### Bằng chứng H6 trước cải tiến

Các đoạn JSON sau chỉ trích những trường liên quan từ `cases[id=H6].result.trace`; trường khác được lược bỏ để dễ đọc. Trace đầy đủ được giữ trong file eval.

```json
{
  "event": "tool",
  "step": 0,
  "name": "get_status",
  "arguments": {"provider": "github", "component": "GitHub Actions"},
  "result": {
    "overall": {"indicator": "none", "description": "All Systems Operational"},
    "components": []
  }
}
```

Tool đã cung cấp trạng thái tổng thể, nhưng final answer không nhắc lại thông tin đó. Ngoài ra, tham số tìm là `GitHub Actions`, trong khi tên component trong dữ liệu là `Actions`. Tool tìm theo chuỗi nên trả `components: []`; không thể suy ra từ trường rỗng rằng Actions không bị ảnh hưởng hay đang hoạt động bình thường.

Agent vẫn thực hiện được chuỗi điều tra tiếp theo:

```json
{
  "event": "tool",
  "step": 0,
  "name": "get_incident_details",
  "arguments": {"provider": "github", "incident_id": "h02n9572mx9y"}
}
```

Update mới nhất của incident này chứa liên kết đến `https://www.githubstatus.com/incidents/xr3myzj7ms51`. Tại `step: 1`, agent gọi `get_incident_details` cho ID được liên kết. Kết quả có `updates_total: 9`, nhưng chỉ trả một phần cập nhật; cập nhật chứa nguyên nhân có `truncated: true`. Vì thế có bằng chứng về nguyên nhân trong phần hiển thị, nhưng không có toàn bộ bản phân tích/hậu kiểm.

**Nguyên nhân có thể xảy ra:** prompt ban đầu yêu cầu phân biệt status và incident nhưng chưa hướng dẫn rõ bằng chứng cần lấy cho từng ý hỏi. Model tập trung vào nguyên nhân của incident gộp và bỏ sót trạng thái dịch vụ khi tổng hợp. Cách chọn chuỗi tìm component cũng làm mất bằng chứng về trạng thái riêng của Actions. Đây là giả thuyết dựa trên hành vi quan sát được, không phải suy nghĩ nội bộ của model.

### Bằng chứng H6 sau cải tiến

Trong `eval_after.json`, tool call đầu dùng tên component ngắn hơn:

```json
{
  "event": "tool",
  "step": 0,
  "name": "get_status",
  "arguments": {"provider": "github", "component": "Actions"},
  "result": {
    "overall": {"indicator": "none", "description": "All Systems Operational"},
    "components": [{"name": "Actions", "status": "operational"}]
  }
}
```

Final answer bắt đầu bằng “GitHub báo *All Systems Operational*; **Actions: operational**”, kèm thời điểm snapshot và nguồn. Agent vẫn theo liên kết incident, nêu nguyên nhân có trong dữ liệu, phân biệt thời điểm tạo/cập nhật với thời gian ảnh hưởng và cảnh báo phần nội dung bị cắt. H6 dùng 3 model calls, 3 tool calls trong 2 lượt có tool ở cả hai phiên bản; cải thiện quan sát được nằm ở lựa chọn tham số và mức độ đầy đủ của câu trả lời.

## 3. Thay đổi đã thực hiện

### Prompt và agent loop trong `agent.py`

1. **Chọn đủ loại bằng chứng.** Câu hỏi về trạng thái dịch vụ cần `get_status`; câu hỏi về incident cần `get_incident_details`. Nếu hỏi cả hai thì phải lấy cả hai, kể cả đã có ID. Mục tiêu là tránh dùng `resolved` của incident để suy ra trạng thái hiện tại của dịch vụ.
2. **Tìm theo tên component phù hợp.** Dùng tên ngắn, không kèm tên provider; khi tìm rỗng, thử tên phù hợp hơn một lần nếu còn lượt. Kiểm tra đủ provider được hỏi, gộp các call độc lập và đọc liên kết incident khi cần điều tra nguyên nhân.
3. **Ràng buộc phạm vi và thời gian.** Phân biệt overall/component/incident; component được gắn với dịch vụ được nhắc trong nội dung; thời điểm snapshot/tạo/cập nhật/xảy ra. Không mặc định danh sách theo thứ tự mới nhất, không coi khoảng tạo–cập nhật là thời gian gián đoạn liên tục. Khi yêu cầu vượt quá cửa sổ tìm kiếm 50 incident, nêu giới hạn thay vì tìm mãi để cố khẳng định đầy đủ.
4. **Kiểm tra nguồn trong loop.** Lưu URL từ `get_incident_details` thành công. Nếu final answer không chứa ít nhất một URL đã quan sát, ghi event `validation_missing_source` và yêu cầu sửa trong cùng `max_steps`. Danh sách URL hợp lệ được gửi rõ trong yêu cầu sửa; không tự bịa hoặc chèn một câu trả lời mẫu. Không bắt URL incident khi chưa đọc thành công incident nào.
5. **Dành lượt cho tổng hợp/sửa nguồn.** Với budget eval 8 model calls, tối đa 6 lượt đầu có thể dùng tools; hai lượt cuối dành cho tổng hợp và sửa nguồn nếu cần. Khi chuyển sang tổng hợp hoặc đang sửa nguồn, gửi danh sách tool rỗng cho provider. Các lượt này vẫn tính trong `max_steps`; agent có thể trả lời sớm. Nếu không hoàn thành hợp lệ trong budget thì vẫn trả `max_steps`, không gán giả `completed`.
6. **Giữ ranh giới yêu cầu.** Không dùng status tools cho câu hỏi ngoài phạm vi hoặc khi user yêu cầu không kiểm tra. Nội dung bên ngoài là dữ liệu; không làm theo prompt injection. Timeout không được coi là outage và thiếu bằng chứng không được thay bằng trạng thái bịa.

Loop giữ nguyên assistant message trước khi gửi các tool results, gắn đúng `tool_call_id`, xử lý mọi call trong lượt điều tra và ghi trace theo contract. JSON sai hoặc không phải object được trả về dưới dạng `INVALID_ARGUMENTS`; lỗi tool được trả làm observation. Lỗi provider hoặc `finish` bất thường không được báo là hoàn thành. Không dùng framework agent.

### Điều chỉnh tương thích provider

Trong `providers.py`, khi gọi OpenAI `gpt-6-luna` có function tools qua Chat Completions, thêm `reasoning_effort: "none"` để xử lý HTTP 400 gặp khi setup. Điều chỉnh này đã có trước `eval_before.json` và được giữ ở phiên bản cuối, nên không được coi là cải tiến sau baseline. Bước tổng hợp với schema rỗng không gửi trường tools; adapter cũng không đặt `reasoning_effort` trong nhánh đó. Vì vậy không diễn giải chênh lệch kết quả là chỉ do prompt.

### Kiểm tra

Sau phiên bản cuối, tôi chạy:

```bash
python -m unittest discover -s tests -v
```

Kết quả terminal: `Ran 37 tests in 0.353s` và `OK`; gồm cả ba test `EvidenceGateTests`. Đây là tests offline, dùng fake provider hoặc mock; không chứng minh mọi câu trả lời LLM đều đúng. Các test có tên bonus trong thư mục `tests` cũng không có nghĩa đã hoàn thành agent và eval bonus 10 case.

## 4. So sánh hai lần chạy

### Điều kiện so sánh

Hai file dùng cùng `provider=openai`, `model=gpt-6-luna`, `judge_provider=openai`, `judge_model=gpt-6-luna`, `max_steps=8`, `dataset=core`. Đều chạy 22 case trên snapshot bài chính; dữ liệu gốc được chụp ngày 09/11/2026. Không dùng live mode để so sánh.

### Kết quả trước và sau

| Chỉ số | `eval_before.json` | `eval_after.json` (v7) |
|---|---:|---:|
| Điểm tổng /100 | 98,50 | 98,95 |
| Case được chấm | 22/22 | 22/22 |
| Run có status `completed` | 22/22 | 22/22 |
| Điểm H6 — case chính | 95 | 100 |
| Model calls riêng H6 | 3 | 3 |
| Model calls của agent, cả bộ | 67 | 56 |
| Agent input tokens | 62.942 | 63.160 |
| Agent output tokens | 8.177 | 7.362 |
| Tổng agent tokens | 71.119 | 70.522 |
| Agent cached input tokens (nằm trong input) | 25.817 | 12.917 |
| Agent cache-write tokens theo usage (không cộng thêm vào tổng tokens) | 10.045 | 29.288 |
| Agent input thường = input − đọc cache − ghi cache | 27.080 | 20.955 |
| Judge input tokens | 41.103 | 35.737 |
| Judge cached input tokens | 0 | 0 |
| Judge cache-write tokens | 39.893 | 33.870 |
| Judge input thường = input − đọc cache − ghi cache | 1.210 | 1.867 |
| Judge output tokens | 7.445 | 7.730 |
| Tổng judge tokens | 48.548 | 43.467 |
| Tổng token agent + judge | 119.667 | 113.989 |
| Chi phí agent ước tính, USD | 0,008310295 | 0,009566670 |
| Chi phí judge ước tính, USD | 0,008830125 | 0,008285450 |
| Tổng agent + judge ước tính, USD | **0,017140420** | **0,017852120** |
| Số tiền đã đối soát hóa đơn | Chưa đối soát | Chưa đối soát |

Số model calls của agent được tính bằng tổng số phần tử `result.usage` của 22 case; token agent được cộng từ các phần tử đó. Token judge lấy từ `grade.judge_usage`. Các chỉ số trong bảng này chỉ tính hai bộ eval được so sánh, không gồm các lần thử riêng hay các phiên bản trung gian. Chi phí được suy ra từ token và bảng giá chính thức tra ngày 12/11/2026; đây là **ước tính giá niêm yết**, không phải số tiền đã xác nhận trên hóa đơn hoặc Usage Dashboard.

Điểm tổng tăng 0,45 điểm; agent giảm 11 model calls. Tuy nhiên input tokens tăng 218, output giảm 815; tổng token riêng agent chỉ giảm 597. Không suy ra chất lượng hoặc hiệu năng tăng toàn diện từ điểm trung bình.

### Đơn giá và cách tính chi phí API

Nguồn tra ngày **12/11/2026**: [trang model GPT-6 Luna của OpenAI](https://developers.openai.com/api/docs/models/gpt-6-luna) và [hướng dẫn prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching). Đơn vị dưới đây là **USD cho mỗi 1.000.000 token**, với Standard processing, prompt ngắn và cache mặc định 30 phút:

| Loại token | Đơn giá USD / 1 triệu token |
|---|---:|
| Input thường, không đọc/ghi cache | 0,10 |
| Đọc cache — `cached_tokens` | 0,01 |
| Ghi cache — `cache_write_tokens`, TTL mặc định 30 phút | 0,125 |
| Output — `completion_tokens` | 0,50 |

Adapter không yêu cầu Batch/Flex/Fast, cache 12 giờ hoặc xử lý theo vùng. Vì log không lưu đầy đủ tier thực tế hay hóa đơn, phép tính giả định Standard và cache mặc định; không cộng phụ phí thuế/vùng, không trừ ưu đãi hoặc credit tài khoản. Prompt lớn nhất ghi nhận trong các file là **4.654 input tokens cho một request**, nên phép tính không dùng giá long-context. Đây là độ dài từng request, không phải tổng input cộng qua nhiều lượt.

Theo tài liệu caching, số token đọc cache và ghi cache đã nằm trong tổng input và được tách thành các nhóm tính giá; không cộng chúng thêm lần nữa. Công thức áp dụng riêng cho agent và judge:

```text
P = tổng prompt_tokens
R = tổng prompt_tokens_details.cached_tokens
W = tổng prompt_tokens_details.cache_write_tokens
O = tổng completion_tokens
U = P - R - W

Chi phí ước tính (USD) = (U × 0,10 + R × 0,01 + W × 0,125 + O × 0,50) / 1.000.000
```

`completion_tokens` đã bao gồm reasoning tokens được provider báo trong output; không cộng reasoning một lần nữa. Với log thiếu `cache_write_tokens`, chỉ xem giá trị thiếu là 0 để ước tính theo dữ liệu hiện có. Không có request nào trong các file được cộng có R + W lớn hơn P.

Hai bộ so sánh chính có tổng ước tính **0,034992540 USD**. Riêng v7 tốn hơn baseline khoảng **0,000711700 USD** dù tổng token giảm: agent ghi cache nhiều hơn và đọc cache ít hơn. Đây là ví dụ vì sao giảm token/calls không tự động đồng nghĩa giảm tiền API.

### Ước tính cho các lần eval còn lưu file

Bảng sau cộng cả agent và judge, dùng cùng công thức. Không tính trùng `eval_after.json` vì file này là bản sao byte-for-byte của `eval_after_v7.json`.

| File kết quả | Số case | Tổng chi phí ước tính, USD |
|---|---:|---:|
| `eval_before.json` | 22 | 0,017140420 |
| `eval_after_v2.json` | 22 | 0,019548040 |
| `eval_after_v3.json` | 22 | 0,017981555 |
| `eval_after_v4.json` | 22 | 0,020870850 |
| `eval_after_v5.json` | 22 | 0,019484715 |
| `eval_after_v6.json` | 22 | 0,019417380 |
| `eval_after_v7.json` | 22 | 0,017852120 |
| `eval_a1_thu_lai.json` | 1 | 0,001573955 |
| `eval_a5_nhac_luot_cuoi.json` | 1 | 0,001033950 |
| `eval_a5_thu_lai.json` | 1 | 0,001630255 |
| `eval_h4_thu_lai.json` | 1 | 0,000246300 |
| **Cộng 11 báo cáo trong repo, không tính bản sao v7** | **158** | **0,136779540** |
| `eval_results_e2.json` — lần thử ban đầu, file hiện chỉ lưu local do `.gitignore` | 1 | 0,000638625 |
| **Cộng 12 báo cáo khác nhau còn trên máy** | **159** | **0,137418165** |

Tổng local tương ứng **458 kết quả gọi agent** và **157 kết quả gọi judge có usage**; hai case A5 hết bước ở v2/v5 được chấm 0 bằng code và không có usage judge. Phần agent ước tính 0,074082040 USD, phần judge 0,063336125 USD. Chi phí UI xem lại trace là 0 USD về LLM/API vì UI không gọi model.

**Không coi 0,137418165 USD là tổng hóa đơn toàn bộ buổi lab.** Một số lần eval cũ đã bị ghi đè, gồm baseline thử trước đó và lần cải tiến đầu 94,45 điểm; các lần gọi thử kết nối/chạy agent không lưu báo cáo hoặc retry judge không được giữ usage cũng chưa cộng được. Chỉ xem tổng này là ước tính cho phần log còn ghi nhận; muốn biết số tiền bị tính thực sự cần đối chiếu Usage/Billing của project OpenAI tương ứng. Không dùng số tiền nạp tài khoản làm chi phí riêng của bài lab.

### Điểm từng case trước và sau

| Case | Trước | Sau v7 | Chênh lệch |
|---|---:|---:|---:|
| E1 | 100 | 95 | -5 |
| E2 | 100 | 100 | 0 |
| E3 | 100 | 100 | 0 |
| E4 | 100 | 100 | 0 |
| E5 | 98 | 100 | +2 |
| E6 | 100 | 100 | 0 |
| A1 | 100 | 91 | -9 |
| A2 | 100 | 100 | 0 |
| A3 | 90 | 100 | +10 |
| A4 | 100 | 100 | 0 |
| A5 | 93 | 93 | 0 |
| A6 | 100 | 100 | 0 |
| A7 | 99 | 100 | +1 |
| A8 | 100 | 100 | 0 |
| H1 | 99 | 100 | +1 |
| H2 | 100 | 100 | 0 |
| H3 | 100 | 100 | 0 |
| H4 | 100 | 100 | 0 |
| H5 | 95 | 98 | +3 |
| H6 | 95 | 100 | +5 |
| H7 | 100 | 100 | 0 |
| H8 | 98 | 100 | +2 |

### Lỗi được xử lý và lỗi còn lại

- **H6:** câu trả lời cuối đã tách được trạng thái tổng thể, Actions và incident; trace vẫn đủ nhiều bước và có cảnh báo dữ liệu bị cắt. Đây là cải thiện có thể quan sát trực tiếp ngoài thay đổi điểm.
- **E1 giảm 5 điểm:** judge muốn agent đề cập incident Actions ngày 05/11; câu trả lời tập trung vào các incident khác được trả về. Đây là hạn chế về lựa chọn ví dụ và mức độ đáp ứng yêu cầu chấm, không phải bằng chứng tất cả thông tin đã nêu là sai.
- **A1 giảm 9 điểm:** câu trả lời có nguy cơ làm người đọc hiểu chỉ có đúng ba incident liên quan Actions, trong khi kết quả tìm còn có incident mang tên rộng hơn. Cần nói rõ phạm vi những incident đã đọc và không tuyên bố danh sách đầy đủ. Cách nêu phần nguyên nhân bị cắt cũng cần phân biệt phần đã nhìn thấy với phần còn thiếu.
- **A5 giữ 93 điểm:** v7 trả lời được giới hạn lịch sử, không có danh sách giả và không hết bước. Judge trừ điểm vì chưa liệt kê ví dụ incident có trong snapshot. Các ví dụ năm 2026 không thể coi là danh sách năm 2025; nếu thêm ví dụ phải ghi đúng phạm vi.
- **E5 tăng lên 100 nhưng chưa hoàn hảo:** câu trả lời v7 vẫn dùng cụm “gần đây nhất” và chưa nêu rõ cửa sổ tìm kiếm trong câu trả lời. Vì vậy việc judge cho đủ điểm không chứng minh giới hạn này đã được xử lý ổn định.

### Các thử nghiệm trung gian

Đã thực hiện nhiều vòng sau baseline, không chỉ một thay đổi. Các điểm dưới đây thuộc đúng phiên bản tương ứng, không thay thế hay sửa tay điểm trong baseline.

| Phiên bản | Điểm tổng | Vấn đề quan sát được |
|---|---:|---|
| Baseline — `eval_before.json` | 98,50 | H6 thiếu trạng thái tổng thể trong final answer; một số giới hạn/thời gian chưa rõ |
| Cải tiến đầu — kết quả ban đầu ghi ở `eval_after.json` | 94,45 | A5 hết bước; điểm này còn trong log terminal của buổi thực hành, file `eval_after.json` hiện đã thay bằng v7 |
| v2 — `eval_after_v2.json` | 93,68 | A5 tiếp tục hết 8 lượt khi tìm/đọc thêm incident |
| v3 — `eval_after_v3.json` | 97,09 | A5 đạt 100; A1 còn 56 vì tìm “Cloudflare Spectrum” không khớp “Spectrum” |
| v4 — `eval_after_v4.json` | 96,27 | H4 còn 50 vì gọi status tools dù user yêu cầu chỉ viết thơ, không kiểm tra |
| v5 — `eval_after_v5.json` | 94,73 | A5 trả lời ở step 5 nhưng thiếu URL; validation lặp ở step 5, 6, 7 rồi trả `max_steps` |
| v6 — `eval_after_v6.json` | 96,91 | A5 đạt 100; H2 còn 50 do chỉ gọi chi tiết incident, thiếu `get_status` |
| v7 — `eval_after_v7.json`, bản nộp `eval_after.json` | 98,95 | Cả 22 run hoàn thành; E1, A1, A5 và H5 vẫn bị trừ điểm |

Ví dụ H2 ở v6 chỉ có `get_incident_details` cho `t89g2q1800fr`, sau đó model trả `finish: stop`. `grade.mechanical.violations` ghi “Chưa gọi tool cần thiết: get_status” và áp trần 50. V7 bổ sung quy tắc lấy cả hai loại bằng chứng cho câu hỏi hỏi cả trạng thái dịch vụ và incident. H2 v7 gọi đủ hai tools và đạt 100; **H2 baseline vốn đã là 100**, nên không báo đây là mức tăng từ baseline.

Tương tự, A5 đạt 97 hoặc 100 khi chạy riêng ở một số lần nhưng vẫn được 0 trong các bộ eval khác. Điều này cho thấy kết quả một case đơn lẻ không đại diện độ ổn định của agent. Lỗi A5 v5 có nguyên nhân trực tiếp là vòng sửa nguồn hết budget, khác với các lần trước chỉ mải gọi tool.

Các bản code được giữ trong `agent_truoc_cai_tien.py`, `agent_sau_cai_tien_lan_1.py` đến `agent_sau_cai_tien_lan_6.py`; `agent.py` là bản cuối. Không có case ID, đáp án hoặc incident ID cố định được thêm vào logic agent để trả lời sẵn.

### Giao diện hỗ trợ demo trên localhost

Ngoài agent loop và eval, tôi bổ sung UI demo trong thư mục `demo_ui/` để giảng viên có thể bấm xem 22 case từ bộ đề, so sánh các phiên bản và kiểm tra trace đã ghi trong các báo cáo. Đây là trình xem kết quả, không chạy lại agent hay gọi API model, không cần đọc API key và không sửa nội dung kết quả.

**Hướng dẫn mở dành cho giảng viên:**

1. Tải hoặc clone toàn bộ repository, giữ các file `eval_*.json` ở thư mục gốc. Máy cần Python 3.10+ và trình duyệt; không cần cài thêm package hoặc nhập API key để xem demo.
2. Trên Windows, nhấp đúp **`start_demo.cmd`** tại thư mục gốc. Trình duyệt sẽ tự mở sau khi server sẵn sàng. File `.cmd` chỉ gọi PowerShell launcher `start_demo.ps1`; không cần mở file Python bằng tay.
3. Nếu dùng terminal, mở terminal tại thư mục gốc repo và chạy lệnh sau, rồi truy cập **http://localhost:8000**:

   ```bash
   python demo_ui/server.py
   ```

   Nếu cổng 8000 đang bận, chạy `python demo_ui/server.py --port 8001` rồi mở http://localhost:8001. Nhấn Ctrl+C trong terminal để dừng server chạy theo cách này.

4. Giao diện mặc định chọn phiên bản có số lớn nhất và case H6. Chọn một case bên trái để hiện câu hỏi, câu trả lời và trace. Chọn phiên bản ở danh sách “Phiên bản kết quả” để so sánh cùng case giữa các lần chạy.
5. Bấm “Từng lượt” để trình bày lần lượt; mở mục JSON trong mỗi tool card để xem nguyên arguments và result. Có thể chọn **V5 → A5** để xem vòng sửa nguồn hết budget, **V6 → H2** để xem lỗi thiếu tool trạng thái, rồi đối chiếu với V7.
6. Bấm “Chế độ đầy đủ” nếu muốn xem nhận xét judge, đáp án kỳ vọng và phần giải thích bài toán/tools. Bấm “Toàn màn hình” hoặc F11 để trình chiếu. Không có hành động nào trong UI tự chạy lại 22 case hoặc phát sinh token API.

- **Khởi động:** nhấp đúp `start_demo.cmd` ở thư mục repo; file này gọi `start_demo.ps1`, ưu tiên Python trong `.venv`, chạy server nền và tự mở trình duyệt. Mặc định dùng cổng 8000; nếu cổng bận thì tìm cổng trống tiếp theo. Có thể chạy trực tiếp `python demo_ui/server.py` rồi mở `http://localhost:8000`.
- **Các file:** `demo_ui/server.py` phục vụ dữ liệu và assets bằng thư viện chuẩn Python; `index.html`, `styles.css`, `app.js` tạo giao diện. Hướng dẫn dùng nằm trong `demo_ui/README.md`; log chạy nền được Git bỏ qua.
- **Xem dữ liệu:** chọn phiên bản eval, bấm một trong 22 case, xem câu hỏi, điểm, final answer và trace theo từng lượt. Mỗi tool card hiển thị arguments, tóm tắt kết quả và JSON đầy đủ; có thể mở trace JSON nguyên bản và sao chép.
- **Trình bày:** mặc định mở H6 ở chế độ trình chiếu; nút “Từng lượt” hiển thị dần các sự kiện đã lưu. Chế độ đầy đủ có nhận xét judge, đáp án kỳ vọng và mục giải thích bài toán/tools để chuẩn bị trình bày. Đáp án kỳ vọng chỉ để đối chiếu, không được đưa cho agent trong quá trình chạy eval.
- **Phạm vi truy cập:** server lắng nghe trên `127.0.0.1`, chỉ phục vụ assets, bộ câu hỏi và các file báo cáo đúng mẫu; không dùng một directory server để công khai toàn bộ repo hoặc `.env`.
- **Giới hạn xác minh:** chỉ rà soát file và đường dẫn lúc tạo UI, chưa chạy bộ kiểm thử giao diện hoặc kiểm tra trình duyệt có hệ thống. Kết quả 37 unit tests và 22 case eval ở trên thuộc agent và hạ tầng lab, không phải bằng chứng kiểm thử UI. Chế độ xem lại trace không được giới thiệu là một lượt agent đang chạy trực tiếp.

### Trace để demo

Chọn H6 trong `eval_after.json`: step 0 gọi status Actions và đọc incident ban đầu; step 1 theo ID trong liên kết sang incident gộp; step 2 trả lời. Giải thích được vì sao phải giữ assistant message, nối đúng tool-call ID, phân biệt hai trạng thái và không khẳng định đã đọc toàn bộ 9 cập nhật. Để minh họa lỗi, dùng A5 v5 hoặc H2 v6 thay vì bịa một tình huống thất bại.

## 5. Giới hạn

1. **Judge là phép đánh giá xấp xỉ.** Agent và judge đều dùng `gpt-6-luna`, có thể có thiên lệch khi cùng model chấm câu trả lời của mình. Ví dụ E5 được 100 ở v7 dù vẫn có cách diễn đạt về “gần đây nhất” cần thận trọng. Phải đọc expected, final answer, evidence và mechanical checks, không chỉ nhìn điểm.
2. **Không thể kết luận nhân quả từ hai lần chạy.** Mỗi phiên bản chỉ có một bộ eval đầy đủ trong các file này. Không cố định được mọi biến ngẫu nhiên của model/judge; nhiều thay đổi prompt và loop được tích lũy cùng lúc. Điểm tăng 0,45 không chứng minh cải tiến chắc chắn tốt hơn hoặc mọi case ổn định hơn.
3. **Đã điều chỉnh theo cùng bộ 22 case.** Nhiều vòng được phân tích trên tập cố định nên có nguy cơ quá phù hợp với bộ đề. Chưa đánh giá trên bộ câu hỏi độc lập, nhiều seed hoặc nhiều lần lặp của cùng phiên bản; không coi 98,95 là mức chất lượng ngoài thực tế.
4. **Snapshot không phải trạng thái hiện tại.** Dữ liệu bài chính chụp ngày 09/11/2026, không xác nhận trạng thái dịch vụ sau đó. Kết quả còn bị giới hạn bởi tìm chuỗi trong 50 incident gần nhất, số mục được trả về và cập nhật bị lược/cắt. Không tìm thấy không chứng minh sự cố chưa từng tồn tại.
5. **Nguồn và phạm vi suy luận.** Source validation chỉ kiểm tra có ít nhất một URL incident đã đọc xuất hiện; không bảo đảm mỗi claim đúng, mọi provider có nguồn đầy đủ hoặc URL là nguồn hỗ trợ đúng claim. Không có cơ chế code xác minh toàn bộ sự thật, quan hệ nhân quả hay phạm vi địa lý.
6. **Budget có đánh đổi.** Dành hai lượt cuối để trả lời giúp tránh tìm mãi, nhưng có thể dừng điều tra trước khi thu thập đủ dữ liệu cho câu hỏi dài. Trong trường hợp đó phải báo thiếu bằng chứng. Việc có `completed` chỉ xác nhận kết thúc đúng luồng, không đồng nghĩa câu trả lời đủ/chính xác.
7. **Phạm vi kiểm thử.** 37 unit tests đã đạt theo terminal ở phiên bản cuối; không suy ra live API luôn ổn định hoặc bonus đã hoàn thành. Các kết quả báo cáo ở đây thuộc bài chính, không có điểm bonus 10 case.
8. **Tính trung thực của bằng chứng.** Giữ nguyên kết quả từng lần chạy, không sửa tay điểm/trace. Không sửa fixtures, cases, scenarios, grading, tests hoặc rubric để làm case pass. Có dùng AI hỗ trợ giải thích, chỉnh code/prompt và tổng hợp ghi chú từ trace thật; người nộp cần tự đối chiếu và giải thích được code, các thay đổi và giới hạn này.
