---
name: meeting-summary
description: |
  사용자가 "/meeting-summary", "회의 요약", "meeting summary"라고 말하거나 오디오 파일에서 회의록을 만들고 싶을 때 사용하세요.
  meeting-transcriber CLI로 오디오를 텍스트로 변환한 후, template.md 형식을 따라 구조화된 회의록을 생성합니다.
  출력 위치: transcripts/{filename}_meeting_notes.md
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
validate_prompt: |
  다음 항목이 포함되어야 합니다:
  1. 오디오 파일 유효성 검사 (존재 여부, 지원 형식)
  2. CLI 실행: npm run transcribe -- <input>
  3. transcript.txt 생성 및 비어있지 않음 확인
  4. template.md 성공적으로 읽기
  5. meeting_notes.md가 transcripts/에 생성됨
  6. 파일 경로와 통계 정보가 포함된 성공 메시지
---

# /meeting-summary — 오디오에서 회의록 생성

오디오 파일을 텍스트로 변환하고 template.md 형식을 따르는 구조화된 회의록을 생성합니다.

---

## Phase 1: 입력 처리 (Input Processing)

### 역할 (Role)
사용자 입력에서 오디오 파일 경로를 추출하고 경로 형식을 정규화합니다.

### 작업 내용

**파일 경로 추출:**
- 사용자 입력을 파싱하여 오디오 파일 경로 가져오기
- 필요한 경우 상대 경로를 절대 경로로 변환

**변수 설정:**
```bash
AUDIO_PATH="{추출된 파일 경로}"
AUDIO_BASENAME=$(basename "$AUDIO_PATH" | sed 's/\.[^.]*$//')
```

---

## Phase 2: 유효성 검사 (Validation)

### 역할 (Role)
오디오 파일의 존재 여부와 지원 형식을 검증합니다.

### 작업 내용

**파일 존재 여부 확인:**
```bash
test -f "$AUDIO_PATH" || echo "File not found"
```

**오디오 형식 확인:**
- 파일 확장자를 추출하여 지원 형식과 비교
- 지원 형식: wav, mp3, m4a, flac, ogg, aac, wma

**오류 처리:**
- 파일이 제공되지 않음 → 사용자에게 요청: "오디오 파일 경로를 입력해주세요."
- 파일을 찾을 수 없음 → 오류: "파일을 찾을 수 없습니다: {path}"
- 지원하지 않는 형식 → 오류: "지원하지 않는 오디오 형식입니다. 지원 형식: wav, mp3, m4a, flac, ogg, aac, wma"

---

## Phase 3: 텍스트 변환 (Transcription)

### 역할 (Role)
오디오를 텍스트로 변환하며, 기존 텍스트가 있는 경우 재사용 여부를 확인합니다.

### 작업 내용

**예상 텍스트 경로 계산:**
```bash
TRANSCRIPT_PATH="transcripts/${AUDIO_BASENAME}.txt"
```

**기존 텍스트 확인:**
`transcripts/${AUDIO_BASENAME}.txt`가 존재하는 경우:

```
AskUserQuestion(
  question: "transcripts/${AUDIO_BASENAME}.txt 이미 존재합니다. 어떻게 할까요?",
  header: "기존 텍스트 발견",
  options: [
    { label: "재사용", description: "기존 텍스트로 회의록 생성" },
    { label: "재변환", description: "오디오를 다시 텍스트로 변환" },
    { label: "취소", description: "작업 취소" }
  ]
)
```

- **재사용** → Phase 5로 건너뛰기
- **재변환** → 기존 텍스트 삭제하고 아래 변환 과정 진행
- **취소** → "회의 요약이 취소되었습니다." 메시지와 함께 종료

**CLI 실행:**
```bash
npm run transcribe -- "$AUDIO_PATH" --format txt
```

**출력 확인:**
```bash
# 파일이 존재하고 비어있지 않은지 확인
if [ -f "$TRANSCRIPT_PATH" ] && [ -s "$TRANSCRIPT_PATH" ]; then
  # 성공
  TRANSCRIPT_SIZE=$(wc -c < "$TRANSCRIPT_PATH")
  CHAR_COUNT=$(wc -m < "$TRANSCRIPT_PATH")
else
  # 오류
fi
```

**CLI 출력에서 메타데이터 추출:**
- 감지된 언어: "🌐 Detected language: {code}"에서 추출
- 처리된 청크 수: "📊 Chunks processed: {count}"에서 추출
- 문자 수: "📝 Character count: {count}"에서 추출

**오류 처리:**
- CLI 실행 실패 → 전체 CLI 출력과 함께 오류
- 텍스트 파일이 비어있음 → 오류: "텍스트 변환 결과가 비어있습니다. 오디오 파일에 음성이 있는지 확인해주세요."

---

## Phase 4: 리소스 로딩 (Resource Loading)

### 역할 (Role)
텍스트 파일과 템플릿 파일을 읽어 들입니다.

### 작업 내용

**텍스트 읽기:**
```bash
TRANSCRIPT_CONTENT=$(cat "$TRANSCRIPT_PATH")
```

**템플릿 읽기:**
```bash
TEMPLATE_PATH="C:\Users\USER\IdeaProjects\dao-workflow\template.md"
TEMPLATE_CONTENT=$(cat "$TEMPLATE_PATH")
```

**오류 처리:**
- 템플릿을 찾을 수 없음 → 오류: "템플릿 파일을 찾을 수 없습니다: {template_path}"

---

## Phase 5: 회의록 생성 (Generation)

### 역할 (Role)
텍스트를 분석하여 template.md 구조에 따른 구조화된 회의록을 생성합니다.
자세한 생성 지침은 `generation-guide.md`를 참조하세요.

### 작업 내용

**생성 가이드 읽기:**
- Read `.claude/skills/meeting-summary/generation-guide.md`

**회의록 생성:**
- `generation-guide.md`의 5단계 프로세스와 섹션별 지침 따르기
- `TEMPLATE_CONTENT`(Phase 4에서 로드)의 구조(이모지, 섹션 순서, 표 형식)를 정확히 따름
- `TRANSCRIPT_CONTENT`를 철저히 분석하여 모든 섹션 채우기
- 결과를 `MEETING_NOTES_CONTENT`에 저장

**오류 처리:**
- generation-guide.md 없음 → 오류: "생성 가이드 파일을 찾을 수 없습니다."

---

## Phase 6: 출력 처리 (Output)

### 역할 (Role)
회의록 파일을 저장하고 성공 메시지를 사용자에게 표시합니다.

### 작업 내용

**출력 경로 설정:**
```bash
MEETING_NOTES_PATH="transcripts/${AUDIO_BASENAME}_meeting_notes.md"
```

**디렉터리 생성:**
```bash
mkdir -p "transcripts"
```

**회의록 작성:**
- 생성된 회의록 내용을 파일에 저장

**오류 처리:**
- 작성 실패 → 오류: "회의록 파일을 저장할 수 없습니다. 권한을 확인해주세요."

**성공 메시지 형식:**
```
✅ 회의 요약이 완료되었습니다!

📁 오디오 파일: {AUDIO_PATH}
📄 텍스트 파일: {TRANSCRIPT_PATH}
📋 회의록: {MEETING_NOTES_PATH}

📊 통계:
   - 문자 수: {CHAR_COUNT}
   - 감지된 언어: {LANGUAGE}
   - 작성된 섹션: {SECTION_COUNT}개

회의록을 확인하시려면 아래 경로를 열어주세요:
{MEETING_NOTES_PATH}
```

**섹션 수 계산:**
- 비어있지 않은 주요 섹션 수 계산 (기본 정보, 회의 목표, 논의 내용, 결정사항, Action Items, 다음 회의 준비)

---

## Reference / Assets

### 파일 참조 (Assets)

| 항목 | 파일 |
|------|------|
| 회의록 출력 템플릿 | `template.md` (프로젝트 루트) |
| 생성 상세 지침 | `.claude/skills/meeting-summary/generation-guide.md` |

### 설정값 (Constants)

| 항목 | 값 |
|------|-----|
| 템플릿 위치 | `C:\Users\USER\IdeaProjects\dao-workflow\template.md` |
| 출력 디렉터리 | `transcripts/` |
| 출력 파일명 패턴 | `{basename}_meeting_notes.md` |
| 지원 오디오 형식 | wav, mp3, m4a, flac, ogg, aac, wma |
| 텍스트 파일 패턴 | `{basename}.txt` |
| 오늘 날짜 | 2026-03-15 |

### CLI 출력 포맷

meeting-transcriber CLI 표준 출력:
```
📄 Output: {path}
📊 Chunks processed: {count}
📝 Character count: {count}
🌐 Detected language: {code}
```

### 오디오 메타데이터 활용

| 메타데이터 | 출처 | 용도 |
|-----------|------|------|
| 감지된 언어 | CLI의 "Detected language" 값 | 통계 표시 |
| 문자 수 | CLI의 "Character count" 값 | 통계 표시 |
| 처리된 청크 수 | CLI의 "Chunks processed" 값 | 통계 표시 |
| 회의 시간 | 오디오 길이 기반 추정 | 기본 정보 섹션 (형식: HH:MM - HH:MM) |

### 오디오 길이 추정 방법

CLI 출력이나 메타데이터에서 오디오 길이를 사용할 수 있는 경우 회의 시간 추정에 사용합니다.
- 형식: HH:MM - HH:MM (시작 시간에 길이를 더해 종료 시간 계산)
- 예: 09:00 - 10:30 (90분 회의)
- 길이를 알 수 없는 경우: "미정" 또는 추정된 시간 사용
