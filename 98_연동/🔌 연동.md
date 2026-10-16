---
type: hub
tags: [hub]
aliases: [Sources, 소스, 외부 연동, 연동]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 🔌 Sources — 외부 연동

> 다른 앱에 흩어진 것을 이 뇌로 끌어오는 **입력 신경**. 세부 설정 절차는 저장소 루트의 `README.md` 4장을 보세요.

## ✍️ GoodNotes 5
- 흐름: GoodNotes `자동 백업(PDF)` → 클라우드 폴더 → `_System/Scripts/import_goodnotes.py` → `80_Sources/GoodNotes/<노트북>.md` (PDF 임베드 + 속성)
- 생성된 노트에는 손글씨 핵심만 텍스트로 옮겨 적고, 관련 책·아이디어와 링크한다.
```dataview
TABLE WITHOUT ID file.link AS "노트북", file.cday AS "가져온 날", area AS "영역"
FROM "80_Sources/GoodNotes"
WHERE type = "goodnotes"
SORT file.cday DESC
```

## 🗓️ Google Calendar
- 흐름: Google Calendar `비공개 iCal 주소` → **ICS 플러그인** → 일간 노트 `## 🗓️ 오늘 일정`에 자동 삽입 (템플릿에 이미 코드가 들어 있음)
- 캘린더 자체를 옵시디언에 저장하지는 않는다. 일간 노트가 그날의 스냅샷이 된다.
- 양방향(옵시디언에서 일정 만들기)이 필요해지면 `Google Calendar` 플러그인(OAuth)으로 승격.

## 📦 MetaData
- 어떤 앱/형식인지에 따라 가져오기 방식이 달라진다 → `80_Sources/MetaData/` 에 내보낸 파일을 두고 README의 질문에 답해 주세요.

## 📎 그 외 후보
- 웹 클리핑: **Obsidian Web Clipper** (브라우저 확장) → `40_Library/Articles` 로 바로 저장되게 템플릿 지정
- 하이라이트: Kindle / 밀리의서재 → `40_Library/Books` 노트의 `## 인상 깊은 문장`에 붙여넣기
- 사진·스캔: `90_Attachments/Images` 로 떨어뜨리면 자동 첨부
