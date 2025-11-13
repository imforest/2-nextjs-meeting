"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface AudioRecorderProps {
  onTranscript?: (text: string) => void;
  onRecordingComplete?: (audioBlob: Blob) => void;
}

type RecordingState = "idle" | "recording" | "paused";

export default function AudioRecorder({
  onTranscript,
  onRecordingComplete,
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0); // 초 단위
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const recorderMimeTypeRef = useRef<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 시간 포맷팅 (HH:MM:SS)
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  const resetAudioGraph = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
    } catch {}
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    analyser.fftSize = 2048;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, width, height);
      // mid line
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--notion-border"
        ) || "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--notion-blue"
        ) || "#3b82f6";
      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 0..2
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  }, []);

  const loadInputDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setLoadingDevices(true);
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const mics = list.filter((d) => d.kind === "audioinput");
      setDevices(mics);
      if (!selectedDeviceId && mics.length > 0) {
        setSelectedDeviceId(mics[0].deviceId);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDevices(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    // 권한이 없는 상태에서도 비어있는 label이 반환될 수 있으므로
    // 최초 1회 시도 후, startRecording에서 권한 허용 뒤 다시 로드
    loadInputDevices();
  }, [loadInputDevices]);

  const mapGetUserMediaError = (err: unknown): string => {
    const name = (err as DOMException)?.name;
    switch (name) {
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "마이크 장치를 찾을 수 없습니다. Windows의 '소리 설정 > 입력'에서 마이크가 연결/활성화되어 있는지 확인하세요.";
      case "NotAllowedError":
      case "SecurityError":
        return "마이크 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 마이크를 '허용'으로 변경한 뒤 새로고침하세요.";
      case "NotReadableError":
        return "다른 프로그램이 마이크를 사용 중일 수 있습니다. 화상회의/녹음 앱을 종료한 후 다시 시도하세요.";
      case "OverconstrainedError":
        return "선택한 마이크를 사용할 수 없습니다. 다른 장치를 선택한 뒤 다시 시도하세요.";
      case "TypeError":
        return "getUserMedia를 사용할 수 없습니다. HTTPS 또는 localhost에서 접속했는지, 지원되는 브라우저인지 확인하세요.";
      default:
        return err instanceof Error
          ? err.message
          : "마이크 접근 중 알 수 없는 오류가 발생했습니다.";
    }
  };

  // 녹음 시작
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTranscript(""); // 이전 변환 결과 초기화
      setDuration(0);
      pausedTimeRef.current = 0;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("getUserMedia not supported", "TypeError");
      }

      const constraints: MediaStreamConstraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // 브라우저 지원 mimeType 탐지
      const candidateTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      let chosenType = "";
      if (
        typeof (window as any).MediaRecorder?.isTypeSupported === "function"
      ) {
        for (const t of candidateTypes) {
          if ((window as any).MediaRecorder.isTypeSupported(t)) {
            chosenType = t;
            break;
          }
        }
      }

      // mimeType이 미지원이면 옵션 없이 생성 (브라우저가 자동 선택)
      const mediaRecorder =
        chosenType !== ""
          ? new MediaRecorder(stream, { mimeType: chosenType })
          : new MediaRecorder(stream);

      recorderMimeTypeRef.current = mediaRecorder.mimeType || chosenType || "";
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // 오디오 그래프 구성 & 웨이브 시작
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      source.connect(analyser);
      drawWave();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        resetAudioGraph();

        const blobType =
          recorderMimeTypeRef.current ||
          (chunksRef.current[0] && (chunksRef.current[0] as any).type) ||
          "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: blobType });
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }

        // 자동으로 텍스트 변환
        await transcribeAudio(audioBlob);

        // 녹음 종료 후 상태 초기화
        setDuration(0);
        pausedTimeRef.current = 0;
      };

      mediaRecorder.start();
      setState("recording");
      startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;

      // 시간 업데이트
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 1000);
      // 권한 허용 후 장치 목록 다시 로드
      loadInputDevices();
    } catch (err) {
      setError(mapGetUserMediaError(err));
    }
  }, [onRecordingComplete, selectedDeviceId, loadInputDevices]);

  // 일시정지
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      pausedTimeRef.current = duration;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [state, duration]);

  // 재개
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
      startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 1000);
    }
  }, [state]);

  // 녹음 종료
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setState("idle");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pausedTimeRef.current = 0;
      resetAudioGraph();
    }
  }, []);

  // 음성을 텍스트로 변환
  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      // FormData 생성
      const formData = new FormData();
      const ext = recorderMimeTypeRef.current.includes("ogg")
        ? "ogg"
        : recorderMimeTypeRef.current.includes("mp4")
        ? "mp4"
        : "webm";
      formData.append("audio", audioBlob, `recording.${ext}`);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "변환에 실패했습니다.");
      }

      const data = await response.json();
      const transcribedText = data.text || "";

      setTranscript(transcribedText);
      if (onTranscript) {
        onTranscript(transcribedText);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "음성 변환 중 오류가 발생했습니다."
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      resetAudioGraph();
    };
  }, []);

  return (
    <div className="w-full">
      {/* 녹음 컨트롤 */}
      <div className="bg-[var(--notion-bg)] border border-[var(--notion-border)] rounded-lg p-6">
        {/* 장치 선택 */}
        <div className="mb-4 flex items-center gap-2">
          <label
            className="text-sm"
            style={{ color: "var(--notion-text-secondary)" }}
          >
            입력 장치
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            style={{
              borderColor: "var(--notion-border)",
              color: "var(--notion-text)",
              backgroundColor: "var(--notion-bg)",
            }}
          >
            {devices.length === 0 && <option value="">마이크 없음</option>}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "마이크"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadInputDevices}
            className="px-2 py-1 text-sm border rounded"
            style={{ borderColor: "var(--notion-border)" }}
            disabled={loadingDevices}
            title="장치 새로고침"
          >
            {loadingDevices ? "새로고침..." : "새로고침"}
          </button>
        </div>

        {/* 시간 표시 */}
        <div className="text-center mb-6">
          <div
            className="text-4xl font-mono font-semibold mb-2"
            style={{ color: "var(--notion-text)" }}
          >
            {formatTime(duration)}
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--notion-text-secondary)" }}
          >
            {state === "recording" && "🔴 녹음 중..."}
            {state === "paused" && "⏸ 일시정지"}
            {state === "idle" && "⏹ 녹음 대기"}
          </div>
        </div>

        {/* 웨이브 표시 */}
        <div className="mb-6">
          <canvas
            ref={canvasRef}
            width={800}
            height={120}
            className="w-full h-[120px] rounded border"
            style={{
              borderColor: "var(--notion-border)",
              backgroundColor: "var(--notion-bg)",
            }}
          />
        </div>

        {/* 버튼 그룹 */}
        <div className="flex items-center justify-center gap-3">
          {state === "idle" && (
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              🎤 녹음 시작
            </button>
          )}

          {state === "recording" && (
            <>
              <button
                onClick={pauseRecording}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                ⏸ 일시정지
              </button>
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                ⏹ 녹음 종료
              </button>
            </>
          )}

          {state === "paused" && (
            <>
              <button
                onClick={resumeRecording}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                ▶ 다시 시작
              </button>
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                ⏹ 녹음 종료
              </button>
            </>
          )}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 변환 중 표시 */}
        {isTranscribing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            <span>음성을 텍스트로 변환하는 중...</span>
          </div>
        )}

        {/* 변환된 텍스트 */}
        {transcript && (
          <div className="mt-4 p-4 bg-[var(--notion-hover)] rounded-lg border border-[var(--notion-border)]">
            <div
              className="text-sm font-medium mb-2"
              style={{ color: "var(--notion-text)" }}
            >
              변환된 텍스트:
            </div>
            <div
              className="text-sm whitespace-pre-wrap"
              style={{ color: "var(--notion-text)" }}
            >
              {transcript}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
