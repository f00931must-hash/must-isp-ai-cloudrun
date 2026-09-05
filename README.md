# MUST 新生 ISP AI Cloud Run

用途：新生 ISP 專用 AI 後端，只提供 `POST /ai/isp-summary`。

部署建議：
- Cloud Run region：`asia-east1`（台灣）
- 最小執行個體：0
- 最大執行個體：3
- Ingress：全部
- 允許公開存取

必要環境變數：
- `GEMINI_API_KEY`
- 可選：`GEMINI_MODEL`（預設 `gemini-3.6-flash`）

健康檢查：部署後直接開 Cloud Run 根網址，應看到 `success: true`。
