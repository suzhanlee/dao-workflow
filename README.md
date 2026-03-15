# Meeting Transcriber

회의 녹음 파일을 자동으로 텍스트로 변환해주는 CLI 도구입니다.

## 기능

- 🎤 **오디오 → 텍스트 변환**: MP3, WAV, M4A 등의 오디오 파일을 텍스트로 변환
- 🎵 **전략 패턴 기반 파싱**: 확장 가능한 파서 구조 (WAV 직접 지원, FLAC 메타데이터 파싱)
- 🌐 **다국어 지원**: 한국어, 영어, 일본어 등 다양한 언어 지원
- 📄 **다양한 출력 포맷**: TXT, SRT(자막), VTT, JSON 형식 지원
- ⚡ **긴 오디오 지원**: 1시간 이상의 긴 파일도 자동으로 청킹하여 처리
- 📊 **진행률 표시**: 실시간 진행률 바 제공
- 🪟 **Windows 호환**: Windows, Mac, Linux 모두 지원

---

## 설치 방법

```bash
# 의존성 설치
npm install

# 빌드
npm run build
```

**결과**: `dist/` 폴더가 생성되고 컴파일된 JavaScript 파일들이 생성됩니다.

---

## 사용 가이드

### 1단계: 설정 초기화

**명령어**:
```bash
node dist/index.js init
```

**결과**:
```
✅ Configuration initialized successfully!
   Created: C:\Users\USER\IdeaProjects\dao-workflow\.env

You can now run:
  meeting-transcriber transcribe <audio-file>
```

**설명**: `.env` 파일이 생성되며 다음과 같은 기본 설정이 포함됩니다:
- Whisper 모델: `base` (속도와 정확도의 균형)
- 청크 길이: 30분
- 출력 디렉토리: `./transcripts`
- 출력 포맷: `txt`

---

### 2단계: 오디오 파일 변환

#### 기본 사용법

**명령어**:
```bash
node dist/index.js transcribe meeting.wav
```

**실행 과정**:
```
ℹ️  Starting transcription...
ℹ️  Reading audio file...
ℹ️  File: meeting.wav
ℹ️  Duration: 5m 30s
ℹ️  Format: WAV
✅ Audio loaded: 5m 30s
ℹ️  Normalizing audio for Whisper (16kHz mono)...
ℹ️  Chunk duration: 30 minutes
✅ Split into 1 chunks
ℹ️  Starting STT process...
ℹ️  Loading Whisper model: base...
   Model loading: 10%
   Model loading: 20%
   ...
✅ Model loaded: base
ℹ️  Transcribing chunk 1/1 (5m 30s)...
Overall Progress |████████████████████| 100% | 1/1 chunks
ℹ️  Merging transcript...

✅ Transcription complete!

📄 Output: ./transcripts/meeting.txt
📊 Chunks processed: 1
📝 Character count: 1250
🌐 Detected language: ko

Preview (first 200 chars):
──────────────────────────────────────────────────
안녕하세요, 오늘의 회의를 시작하겠습니다. 첫 번째 안건은 프로젝트 진행 상황에 대한 ...
──────────────────────────────────────────────────
```

**결과**: `./transcripts/meeting.txt` 파일이 생성됩니다.

---

### 3단계: 출력 파일 확인

**생성된 파일**: `./transcripts/meeting.txt`

**내용 예시**:
```
안녕하세요, 오늘의 회의를 시작하겠습니다. 첫 번째 안건은 프로젝트 진행 상황에 대한 보고입니다.
김 팀장님 먼저 말씀해 주시겠습니까?

네, 지난 주에 진행한 개발 작업은 80% 정도 완료되었습니다. 현재 테스트 단계에 들어갔으며,
다음 주 초에는 배포가 가능할 것으로 예상됩니다.

좋습니다. 그럼 다음 안건으로 넘어가겠습니다.
```

---

## 다양한 사용 시나리오

### 시나리오 1: SRT 자막 파일 생성

**목적**: 동영상 자막을 위한 타임스탬프가 포함된 자막 파일 생성

**명령어**:
```bash
node dist/index.js transcribe meeting.wav --format srt --output subtitles.srt
```

**실행 과정**:
```
ℹ️  Starting transcription...
...
✅ Transcription complete!

📄 Output: ./transcripts/subtitles.srt
📊 Chunks processed: 1
```

**결과 파일**: `./transcripts/subtitles.srt`
```
1
00:00:00,000 --> 00:00:05,000
안녕하세요, 오늘의 회의를 시작하겠습니다.

2
00:00:05,000 --> 00:00:10,000
첫 번째 안건은 프로젝트 진행 상황에 대한 보고입니다.

3
00:00:10,000 --> 00:00:15,000
김 팀장님 먼저 말씀해 주시겠습니까?

4
00:00:15,000 --> 00:00:22,000
네, 지난 주에 진행한 개발 작업은 80% 정도 완료되었습니다.
```

---

### 시나리오 2: JSON 형식으로 내보내기

**목적**: 프로그래머틱하게 처리하기 위한 구조화된 데이터 생성

**명령어**:
```bash
node dist/index.js transcribe meeting.wav --format json --output meeting.json
```

**결과 파일**: `./transcripts/meeting.json`
```json
{
  "text": "안녕하세요, 오늘의 회의를 시작하겠습니다...",
  "segments": [
    {
      "start": 0,
      "end": 5.2,
      "text": "안녕하세요, 오늘의 회의를 시작하겠습니다."
    },
    {
      "start": 5.2,
      "end": 10.5,
      "text": "첫 번째 안건은 프로젝트 진행 상황에 대한 보고입니다."
    }
  ],
  "language": "ko"
}
```

---

### 시나리오 3: 언어 지정 (한국어)

**목적**: 언어를 명시적으로 지정하여 더 정확한 결과 얻기

**명령어**:
```bash
node dist/index.js transcribe meeting.wav --language ko
```

**설명**: `--language ko` 옵션을 사용하면 한국어로 인식하여 변환합니다.

---

### 시나리오 4: 더 정확한 모델 사용

**목적**: 중요한 회의일 경우 더 정확한 모델 사용

**명령어**:
```bash
node dist/index.js transcribe meeting.wav --model small
```

**설명**: `base` 모델보다 `small` 모델이 더 정확하지만 처리 시간이 깁니다.

**실행 결과**:
```
ℹ️  Loading Whisper model: small...
   Model loading: 10%
   Model loading: 20%
   ...
✅ Model loaded: small
```

---

### 시나리오 5: 1시간 이상의 긴 오디오 처리

**목적**: 긴 회의 녹음 파일 처리

**명령어**:
```bash
node dist/index.js transcribe long-meeting.wav --chunk-duration 20
```

**설명**: `--chunk-duration 20`으로 설정하면 20분 단위로 나누어 처리합니다.

**실행 과정**:
```
ℹ️  Chunk duration: 20 minutes
✅ Split into 4 chunks
ℹ️  Starting STT process...
ℹ️  Loading Whisper model: base...
✅ Model loaded: base

Overall Progress |████████░░░░░░░░░░░░| 50% | 2/4 chunks
ℹ️  Transcribing chunk 2/4 (20m 0s)...

Overall Progress |████████████████████| 100% | 4/4 chunks

✅ Transcription complete!
📊 Chunks processed: 4
```

---

### 시나리오 6: 영어로 번역

**목적**: 외국어 회의 내용을 영어로 번역

**명령어**:
```bash
node dist/index.js transcribe korean-meeting.wav --translate
```

**결과**: 한국어 회의 내용이 영어로 번역됩니다.
```
Hello, let's start today's meeting. The first agenda item is a report on project progress.
```

---

## 명령어 옵션 상세

### transcribe 명령어

```bash
node dist/index.js transcribe [options] <input>
```

| 옵션 | 설명 | 예시 |
|------|------|------|
| `<input>` | 변환할 오디오 파일 경로 (필수) | `meeting.wav` |
| `-o, --output <path>` | 출력 파일 경로 지정 | `--output result.txt` |
| `-f, --format <format>` | 출력 포맷 (txt, srt, vtt, json) | `--format srt` |
| `-m, --model <model>` | Whisper 모델 선택 | `--model small` |
| `-l, --language <code>` | 언어 코드 지정 | `--language ko` |
| `-t, --translate` | 영어로 번역 | `--translate` |
| `--no-progress` | 진행률 바 표시 안 함 | `--no-progress` |
| `--chunk-duration <minutes>` | 청크 길이 설정 (분) | `--chunk-duration 15` |

### init 명령어

```bash
node dist/index.js init [options]
```

| 옵션 | 설명 |
|------|------|
| `-f, --force` | 기존 .env 파일 덮어쓰기 |
| `-m, --model <model>` | 기본 모델 설정 |

---

## 오디오 파일 준비

### WAV 파일 (권장)

WAV 파일은 바로 변환할 수 있습니다. 8-bit, 16-bit, 24-bit, 32-bit PCM 형식을 지원합니다.

```bash
node dist/index.js transcribe meeting.wav
```

### FLAC 파일

FLAC 파일은 메타데이터 파싱만 가능합니다. 오디오 변환을 위해서는 WAV로 변환해야 합니다.

**참고**: FLAC 파일을 직접 변환하면 다음과 같은 메시지가 표시됩니다:
```
FLAC decoding requires external library or ffmpeg conversion.
For now, please convert FLAC files to WAV format.
Suggestion: Convert to WAV using: ffmpeg -i input.flac output.wav
```

**ffmpeg로 변환 후 사용**:
```bash
# FLAC → WAV
ffmpeg -i meeting.flac -ar 16000 -ac 1 meeting.wav

# 변환 후 변환 실행
node dist/index.js transcribe meeting.wav
```

### MP3/M4A/OGG/AAC/WMA 파일

이 포맷들은 ffmpeg로 WAV로 변환해야 합니다.

**ffmpeg 설치**: https://ffmpeg.org/download.html

**변환 명령어**:
```bash
# MP3 → WAV
ffmpeg -i meeting.mp3 -ar 16000 -ac 1 meeting.wav

# M4A → WAV
ffmpeg -i meeting.m4a -ar 16000 -ac 1 meeting.wav

# OGG → WAV
ffmpeg -i meeting.ogg -ar 16000 -ac 1 meeting.wav
```

**옵션 설명**:
- `-ar 16000`: 샘플 레이트를 16kHz로 설정 (Whisper 추천)
- `-ac 1`: 모노 채널로 설정

**변환 후**:
```bash
node dist/index.js transcribe meeting.wav
```

---

## 언어 코드

| 코드 | 언어 |
|------|------|
| `ko` | 한국어 |
| `en` | 영어 |
| `ja` | 일본어 |
| `zh` | 중국어 |
| `es` | 스페인어 |
| `fr` | 프랑스어 |
| `de` | 독일어 |

---

## 모델 비교

| 모델 | 크기 | 속도 | 정확도 | 용도 |
|------|------|------|--------|------|
| `tiny` | ~40MB | 가장 빠름 | 낮음 | 빠른 테스트 |
| `base` | ~75MB | 빠름 | 좋음 | 일반 사용 (권장) |
| `small` | ~250MB | 보통 | 더 좋음 | 정확한 결과 필요 시 |
| `medium` | ~770MB | 느림 | 높음 | 중요한 회의 |
| `large-v3` | ~1.5GB | 가장 느림 | 최고 | 최고 품질 필요 시 |

---

## 출력 포맷 비교

### TXT (기본)
```
안녕하세요, 오늘의 회의를 시작하겠습니다.
```
- 용도: 일반 텍스트, 문서 저장

### SRT
```
1
00:00:00,000 --> 00:00:05,000
안녕하세요, 오늘의 회의를 시작하겠습니다.
```
- 용도: 동영상 자막

### VTT
```
WEBVTT

00:00:00.000 --> 00:00:05.000
안녕하세요, 오늘의 회의를 시작하겠습니다.
```
- 용도: 웹 플레이어 자막

### JSON
```json
{
  "text": "안녕하세요...",
  "segments": [{"start": 0, "end": 5, "text": "안녕하세요..."}],
  "language": "ko"
}
```
- 용도: 프로그래밍 처리, 데이터 분석

---

## 설정 파일 (.env)

```env
# Whisper 모델 설정
WHISPER_MODEL=base

# 오디오 처리 설정 (청크 길이: 분)
CHUNK_DURATION_MINUTES=30

# 출력 설정
OUTPUT_DIR=./transcripts
DEFAULT_OUTPUT_FORMAT=txt

# 진행률 바 설정
SHOW_PROGRESS=true

# 모델 캐시 디렉토리
MODEL_CACHE_DIR=./.cache
```

---

## 문제 해결

### 1. 모델을 찾을 수 없음
**에러**: `Failed to load model`
**해결**: `.env` 파일의 `WHISPER_MODEL` 값이 올바른지 확인하세요. (`tiny`, `base`, `small`, `medium`, `large-v3` 중 하나)

### 2. 메모리 부족
**에러**: `Out of memory`
**해결**:
- 더 작은 모델 사용 (`tiny` 또는 `base`)
- 청크 길이 줄이기 (`--chunk-duration 10`)

### 3. 오디오 형식 지원 안 함
**에러**: `Unsupported audio format` 또는 `No parser available for format 'xxx'`
**해결**:
- **WAV 파일**: 8/16/24/32-bit PCM 형식인지 확인
- **다른 포맷**: ffmpeg로 WAV로 변환
```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav
ffmpeg -i input.flac -ar 16000 -ac 1 output.wav
```
- **지원 포맷 확인**:
  - 직접 지원: WAV (8/16/24/32-bit PCM)
  - 메타데이터 파싱만: FLAC
  - ffmpeg 변환 필요: MP3, M4A, OGG, AAC, WMA

### 4. 변환이 너무 느림
**해결**:
- 더 작은 모델 사용 (`tiny` 또는 `base`)
- 진행률 바 끄기 (`--no-progress`)

---

## 프로젝트 구조

```
dao-workflow/
├── src/
│   ├── commands/
│   │   ├── init.ts          # 설정 초기화 명령어
│   │   └── transcribe.ts    # 변환 명령어
│   ├── modules/
│   │   ├── audio.ts         # 오디오 처리 (파싱, 청킹)
│   │   ├── parsers/         # 오디오 파서 (전략 패턴)
│   │   │   ├── AudioParser.ts      # 파서 인터페이스
│   │   │   ├── BaseParser.ts       # 공통 기능 추상 클래스
│   │   │   ├── ParserRegistry.ts   # 파서 레지스트리/팩토리
│   │   │   ├── ParserError.ts      # 파서 에러 클래스
│   │   │   ├── WavParser.ts       # WAV 파서
│   │   │   └── FlacParser.ts      # FLAC 파서 (기본)
│   │   ├── progress.ts      # 진행률 표시
│   │   └── stt.ts           # Whisper STT 엔진
│   ├── utils/
│   │   └── config.ts        # 설정 관리
│   └── index.ts             # CLI 진입점
├── dist/                    # 빌드 결과물
├── transcripts/             # 변환 결과물 (자동 생성)
├── .env                     # 설정 파일 (init 명령어로 생성)
├── .env.example             # 설정 파일 템플릿
├── package.json
├── tsconfig.json
└── README.md
```

---

## 기술 스택

- **언어**: TypeScript (Node.js 20+)
- **CLI 프레임워크**: Commander.js
- **STT 엔진**: @xenova/transformers (Whisper WASM)
- **오디오 처리**: 전략 패턴 기반 파서 (WAV 직접 파싱, FLAC 메타데이터 파싱)
- **진행률**: cli-progress
- **검증**: Zod

---

## 라이선스

MIT
