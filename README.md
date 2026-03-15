# Meeting Transcriber

회의 녹음 파일을 자동으로 텍스트로 변환해주는 CLI 도구입니다.

## 기능

- **오디오 → 텍스트 변환**: MP3, WAV, M4A, FLAC 등 오디오 파일을 텍스트로 변환
- **Groq Whisper API**: 클라우드 기반 STT — 빠르고 high quality (large-v3)
- **대용량 파일 자동 청킹**: 25MB 초과 파일은 자동으로 분할 후 병합
- **다국어 지원**: 한국어, 영어, 일본어 등 다양한 언어 지원
- **다양한 출력 포맷**: TXT, SRT(자막), VTT, JSON 형식 지원
- **ffmpeg 내장**: 별도 설치 없이 모든 오디오 포맷 바로 사용 가능

---

## 설치 방법

```bash
npm install
npm run build
```

---

## 초기 설정

`.env` 파일에 Groq API 키를 추가합니다.

```env
GROQ_API_KEY=gsk_xxxxx
```

API 키는 [console.groq.com](https://console.groq.com) 에서 발급받을 수 있습니다. 무료 티어 기준 하루 8시간까지 사용 가능합니다.

---

## 사용법

### 기본

```bash
npm run transcribe -- <오디오파일>
```

```bash
npm run transcribe -- meeting.mp3
npm run transcribe -- "C:/Users/USER/Downloads/회의록.flac"
```

결과물은 `./transcripts/` 폴더에 저장됩니다.

---

### 옵션

```bash
npm run transcribe -- <input> [options]
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `<input>` | 변환할 오디오 파일 경로 (필수) | |
| `-o, --output <path>` | 출력 파일 경로 직접 지정 | `./transcripts/<파일명>.<포맷>` |
| `-f, --format <format>` | 출력 포맷 (`txt`, `srt`, `vtt`, `json`) | `.env`의 `DEFAULT_OUTPUT_FORMAT` |
| `-m, --model <model>` | Whisper 모델 선택 | `.env`의 `WHISPER_MODEL` |
| `-l, --language <code>` | 언어 코드 지정 (미지정 시 자동 감지) | `.env`의 `TRANSCRIBE_LANGUAGE` |
| `-t, --translate` | 결과를 영어로 번역 | |
| `--no-progress` | 진행 로그 표시 안 함 | |

---

### 출력 포맷 예시

#### JSON (기본값)
타임스탬프가 포함된 구조화된 데이터. 후처리에 적합합니다.

```json
{
  "text": "안녕하세요, 오늘의 회의를 시작하겠습니다...",
  "segments": [
    { "start": 0, "end": 3.2, "text": "안녕하세요" },
    { "start": 3.2, "end": 7.5, "text": "오늘의 회의를 시작하겠습니다." }
  ],
  "language": "ko"
}
```

#### TXT
순수 텍스트.

```
안녕하세요, 오늘의 회의를 시작하겠습니다.
```

#### SRT
동영상 자막용.

```
1
00:00:00,000 --> 00:00:03,200
안녕하세요

2
00:00:03,200 --> 00:00:07,500
오늘의 회의를 시작하겠습니다.
```

#### VTT
웹 플레이어 자막용.

```
WEBVTT

00:00:00.000 --> 00:00:03.200
안녕하세요
```

---

### 사용 예시

```bash
# 기본 (JSON 출력)
npm run transcribe -- meeting.mp3

# SRT 자막 생성
npm run transcribe -- meeting.mp3 -f srt

# 언어 지정
npm run transcribe -- meeting.mp3 -l ko

# 영어로 번역
npm run transcribe -- meeting.mp3 -t

# 출력 경로 직접 지정
npm run transcribe -- meeting.mp3 -o ./output/result.json

# turbo 모델 사용 (더 빠름, 약간 낮은 정확도)
npm run transcribe -- meeting.mp3 -m whisper-large-v3-turbo
```

---

## 모델 비교

| 모델 | 속도 | 정확도 | 비고 |
|------|------|--------|------|
| `whisper-large-v3` | 빠름 | 최고 | 기본값 |
| `whisper-large-v3-turbo` | 더 빠름 | 높음 | 속도 우선 시 |

두 모델 모두 Groq 클라우드에서 실행되므로 로컬 리소스는 거의 사용하지 않습니다.

---

## 설정 파일 (.env)

```env
# Groq API 키 (필수)
GROQ_API_KEY=gsk_xxxxx

# Whisper 모델 (whisper-large-v3 | whisper-large-v3-turbo)
WHISPER_MODEL=whisper-large-v3

# 기본 언어 (ko, en, ja 등 — 비워두면 자동 감지)
TRANSCRIBE_LANGUAGE=ko

# 청크 길이 (분) — 25MB 초과 파일 분할 기준
CHUNK_DURATION_MINUTES=30

# 출력 디렉토리
OUTPUT_DIR=./transcripts

# 기본 출력 포맷 (txt | srt | vtt | json)
DEFAULT_OUTPUT_FORMAT=json

# 진행 로그 표시 여부
SHOW_PROGRESS=true
```

---

## 지원 오디오 포맷

MP3, WAV, M4A, FLAC, OGG, AAC, WMA 등 ffmpeg에서 지원하는 모든 포맷. 별도 변환 불필요.

---

## 문제 해결

**`GROQ_API_KEY is not set`**
`.env` 파일에 `GROQ_API_KEY`가 설정되어 있는지 확인하세요.

**`413 Request Entity Too Large`**
파일이 25MB를 초과했지만 청킹이 동작하지 않은 경우입니다. `.env`의 `CHUNK_DURATION_MINUTES`를 줄여보세요 (예: `15`).

**`ffprobe failed`**
`npm install` 후 다시 시도하세요. ffmpeg/ffprobe는 npm 패키지로 자동 설치됩니다.

---

## 프로젝트 구조

```
dao-workflow/
├── src/
│   ├── commands/
│   │   ├── init.ts          # 설정 초기화 명령어
│   │   └── transcribe.ts    # 변환 명령어
│   ├── modules/
│   │   ├── audio.ts         # 오디오 처리
│   │   ├── parsers/         # 오디오 파서
│   │   ├── progress.ts      # 진행 로그
│   │   └── stt.ts           # Groq Whisper API 연동
│   ├── utils/
│   │   └── config.ts        # 설정 관리
│   └── index.ts             # CLI 진입점
├── transcripts/             # 변환 결과물 (자동 생성)
├── .env                     # 설정 파일
└── package.json
```

---

## 기술 스택

- **언어**: TypeScript (Node.js 20+)
- **CLI 프레임워크**: Commander.js
- **STT**: Groq Whisper API (`groq-sdk`)
- **오디오 처리**: fluent-ffmpeg (ffmpeg/ffprobe 내장)
- **설정 검증**: Zod

---

## 라이선스

MIT
