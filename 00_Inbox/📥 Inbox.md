---
type: hub
tags: [hub]
aliases: [Inbox, 인박스, 수신함]
up: "[[🧠 Brain]]"
cssclasses: [hub]
---
# 📥 Inbox

> 모든 입력의 시작점. 여기 있는 노트는 아직 **자리를 못 찾은 것**. 비울수록 뇌가 맑아진다.

## 처리 대기
```dataview
TABLE WITHOUT ID file.link AS "노트", file.tags AS "태그", file.cday AS "생성", (date(today) - file.cday).days AS "경과(일)"
FROM "00_Inbox"
WHERE type != "hub"
SORT file.cday ASC
```

## 자리 찾아주는 3가지 방법
1. **태그 하나** — 본문 아무 데나 `#book` `#article` `#journal` `#idea` `#project` `#person` `#area` 를 붙이면 Auto Note Mover가 폴더로 옮긴다. 옮긴 뒤 `Templater: Insert template`로 템플릿을 입히면 끝.
2. **드래그** — 파일 탐색기에서 폴더로 끌어다 놓는다.
3. **삭제** — 다시 볼 일 없으면 과감히.

> [!tip] 애초에 Inbox에 안 쌓이게 하려면
> 새 노트를 만들 때 뜨는 "이 노트는 무엇인가요?" 메뉴에서 유형을 고르세요. 그러면 처음부터 제자리에 생깁니다.
