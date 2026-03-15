#!/usr/bin/env python3
"""
faster-whisper STT engine.
Reads audio file, outputs JSON progress to stderr, final result to stdout.
"""

import argparse
import json
import sys


def emit_status(message: str) -> None:
    print(json.dumps({"type": "status", "message": message}), file=sys.stderr, flush=True)


def emit_progress(progress: float) -> None:
    print(json.dumps({"type": "transcribing", "progress": progress}), file=sys.stderr, flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper")
    parser.add_argument("--file", required=True, help="Input audio file path")
    parser.add_argument("--model", default="large-v3", help="Whisper model size")
    parser.add_argument("--language", default=None, help="Language code (e.g. ko, en)")
    parser.add_argument("--task", default="transcribe", choices=["transcribe", "translate"])
    parser.add_argument("--beam-size", type=int, default=5, help="Beam size for decoding")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster_whisper not installed. Run: pip install faster-whisper"}))
        sys.exit(1)

    try:
        emit_status(f"Loading model: {args.model}")
        model = WhisperModel(args.model, device="cpu", compute_type="int8")

        emit_status(f"Transcribing: {args.file}")
        segments, info = model.transcribe(
            args.file,
            language=args.language,
            task=args.task,
            beam_size=args.beam_size,
        )

        emit_status("Processing segments...")
        result_segments = []
        duration = info.duration if info.duration and info.duration > 0 else None

        for segment in segments:
            result_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
            })
            emit_status(f"[{segment.start:.1f}s] {segment.text.strip()}")
            if duration and duration > 0:
                pct = round((segment.end / duration) * 100, 1)
                emit_progress(min(pct, 99.0))

        full_text = " ".join(s["text"] for s in result_segments)

        emit_progress(100.0)

        print(json.dumps({
            "text": full_text,
            "language": info.language,
            "segments": result_segments,
        }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
