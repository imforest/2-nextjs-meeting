"use client";
import Image from "next/image";
import AudioRecorder from "@/components/AudioRecorder";
import { useEffect, useState } from "react";
import MemoEditor from "@/components/MemoEditor";

export default function Home() {
  const [memoHtml, setMemoHtml] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [transcript, setTranscript] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [aiDetailedText, setAiDetailedText] = useState<string>("");
  const [aiError, setAiError] = useState<string>("");
  const [isDetailedLoading, setIsDetailedLoading] = useState<boolean>(false);
  const [webhookStatus, setWebhookStatus] = useState<{
    loading: boolean;
    success: boolean;
    error: string;
  }>({ loading: false, success: false, error: "" });
  const [detailed, setDetailed] = useState<{
    title: string;
    date: string;
    time: string;
    location: string;
    host: string;
    facilitator?: string;
    objective: string;
    attendees: string[];
    agenda: Array<{
      title: string;
      discussion: string[];
      decision?: string;
      due?: string;
    }>;
  } | null>(null);

  // LocalStorage keys
  const MEMO_KEY = "meeting:memo";
  const FILES_KEY = "meeting:files";
  const TRANSCRIPT_KEY = "meeting:transcript";
  const SUMMARY_KEY = "meeting:summary";
  const DETAILED_KEY = "meeting:detailed";

  // Restore memo and files on mount
  useEffect(() => {
    try {
      const savedMemo = localStorage.getItem(MEMO_KEY);
      if (savedMemo) {
        setMemoHtml(savedMemo);
      }
      // no longer restoring transcript/summary (remove any leftover test data separately)
      const savedFilesJson = localStorage.getItem(FILES_KEY);
      if (savedFilesJson) {
        const saved = JSON.parse(savedFilesJson) as {
          name: string;
          type: string;
          size: number;
          dataUrl: string;
        }[];
        // Recreate File-like objects via dataURL; keep as Blob with name metadata
        const reconstructed = saved.map((f) => {
          const byteString = atob(f.dataUrl.split(",")[1] ?? "");
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], {
            type: f.type || "application/octet-stream",
          });
          return new File([blob], f.name, {
            type: f.type || "application/octet-stream",
            lastModified: Date.now(),
          });
        });
        setFiles(reconstructed);
      }
    } catch {
      // ignore
    }
  }, []);

  // Remove any previously saved transcript/summary (cleanup test data)
  useEffect(() => {
    try {
      localStorage.removeItem(TRANSCRIPT_KEY);
      localStorage.removeItem(SUMMARY_KEY);
      setTranscript("");
      setSummary("");
    } catch {
      // ignore
    }
  }, []);

  // Clean up legacy mock detailed data from localStorage once
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DETAILED_KEY);
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj?.title === "2024년 마케팅 전략회의") {
          localStorage.removeItem(DETAILED_KEY);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Autosave memo
  const handleSaveMemo = (content: string) => {
    setMemoHtml(content);
    try {
      localStorage.setItem(MEMO_KEY, content);
    } catch {
      // ignore
    }
  };

  // Autosave transcript
  useEffect(() => {
    try {
      localStorage.setItem(TRANSCRIPT_KEY, transcript);
    } catch {
      // ignore
    }
  }, [transcript]);

  // Save summary
  const saveSummary = (text: string) => {
    setSummary(text);
    try {
      localStorage.setItem(SUMMARY_KEY, text);
    } catch {
      // ignore
    }
  };

  // AI API helpers
  const AI_ENDPOINT = "/api/ai/minutes";
  const generateSummaryWithAI = async (
    fullTranscript: string,
    meta?: { title?: string; objective?: string; attendees?: string[] }
  ) => {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: fullTranscript, meta }),
    });
    if (!res.ok) {
      throw new Error("AI summary failed");
    }
    const data = await res.json();
    return String(data.summary || "");
  };
  const generateDetailedWithAI = async (
    fullTranscript: string,
    meta?: { title?: string; objective?: string; attendees?: string[] }
  ) => {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: fullTranscript, meta }),
    });
    if (!res.ok) {
      throw new Error("AI detailed failed");
    }
    const data = await res.json();
    return String(data.detailed || "");
  };

  // Convert selected files to dataURLs and persist (limit 100MB each)
  const handleAddFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const MAX = 100 * 1024 * 1024;
    const valid: File[] = [];
    for (const file of Array.from(selected)) {
      if (file.size <= MAX) valid.push(file);
    }
    const next = [...files, ...valid];
    setFiles(next);
    // persist
    try {
      const encodes = await Promise.all(
        next.map(
          (f) =>
            new Promise<{
              name: string;
              type: string;
              size: number;
              dataUrl: string;
            }>((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({
                  name: f.name,
                  type: f.type,
                  size: f.size,
                  dataUrl: String(reader.result),
                });
              reader.readAsDataURL(f);
            })
        )
      );
      localStorage.setItem(FILES_KEY, JSON.stringify(encodes));
    } catch {
      // ignore
    }
  };

  const handleRemoveFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    try {
      const encodesPromises = next.map(
        (f) =>
          new Promise<{
            name: string;
            type: string;
            size: number;
            dataUrl: string;
          }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: f.name,
                type: f.type,
                size: f.size,
                dataUrl: String(reader.result),
              });
            reader.readAsDataURL(f);
          })
      );
      Promise.all(encodesPromises).then((encodes) => {
        localStorage.setItem(FILES_KEY, JSON.stringify(encodes));
      });
    } catch {
      // ignore
    }
  };

  // AI summary trigger
  const handleCreateAISummary = async () => {
    if (!transcript.trim()) {
      setAiError("회의 전체 내용이 없습니다. 먼저 녹음을 완료하세요.");
      return;
    }
    setIsSummarizing(true);
    setAiError("");
    try {
      const meta = {
        title: detailed?.title,
        objective: detailed?.objective,
        attendees: detailed?.attendees,
      };
      const aiSummary = await generateSummaryWithAI(transcript, meta);
      saveSummary(aiSummary);
    } catch (e: any) {
      setAiError(e?.message || "요약 생성 중 오류가 발생했습니다.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // AI detailed trigger
  const handleCreateAIDetailed = async () => {
    if (!transcript.trim()) {
      setAiError("회의 전체 내용이 없습니다. 먼저 녹음을 완료하세요.");
      return;
    }
    setAiError("");
    const meta = {
      title: detailed?.title,
      objective: detailed?.objective,
      attendees: detailed?.attendees,
    };
    try {
      setIsDetailedLoading(true);
      const text = await generateDetailedWithAI(transcript, meta);
      setAiDetailedText(text);
    } catch (e: any) {
      setAiError(e?.message || "상세 회의록 생성 중 오류가 발생했습니다.");
    } finally {
      setIsDetailedLoading(false);
    }
  };

  // Webhook 전송
  const handleSendWebhook = async () => {
    setWebhookStatus({ loading: true, success: false, error: "" });
    try {
      const payload = {
        memo: memoHtml || "",
        summary: summary || "",
        detailed: aiDetailedText || "",
        meetingInfo: detailed
          ? {
              title: detailed.title,
              date: detailed.date,
              time: detailed.time,
              location: detailed.location,
              host: detailed.host,
              facilitator: detailed.facilitator,
              objective: detailed.objective,
              attendees: detailed.attendees,
              agenda: detailed.agenda,
            }
          : null,
        timestamp: new Date().toISOString(),
      };

      // 서버 사이드 API 라우트를 통해 전송 (CORS 및 보안 이슈 해결)
      const response = await fetch("/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `웹훅 전송 실패: ${response.status}`;
        const detailsMsg = data.details ? `\n${data.details}` : "";
        throw new Error(errorMsg + detailsMsg);
      }

      setWebhookStatus({ loading: false, success: true, error: "" });
      setTimeout(() => {
        setWebhookStatus({ loading: false, success: false, error: "" });
      }, 3000);
    } catch (e: any) {
      setWebhookStatus({
        loading: false,
        success: false,
        error: e?.message || "웹훅 전송 중 오류가 발생했습니다.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        {/* 실시간 웨이브가 보이는 녹음 위젯 */}
        <div className="w-full my-8">
          <AudioRecorder onTranscript={(text) => setTranscript(text)} />
        </div>

        {/* 회의 요약본 */}
        <section className="w-full my-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              🧠 AI 회의 요약본
            </h2>
            <button
              type="button"
              onClick={handleCreateAISummary}
              className="h-9 px-3 rounded-full text-sm border border-black/10 dark:border-white/20 hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
              disabled={isSummarizing}
            >
              {isSummarizing ? "요약 생성 중..." : "요약 생성 (AI)"}
            </button>
          </div>
          {aiError && (
            <div className="mb-2 text-sm text-red-600 dark:text-red-400">
              {aiError}
            </div>
          )}
          <div className="rounded-lg border border-black/10 dark:border-white/20 p-4 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 leading-7">
            {summary ||
              "아직 생성된 요약이 없습니다. 상단에서 회의 내용을 입력한 뒤 '요약 생성 (AI)'을 눌러 생성하세요."}
          </div>
        </section>

        {/* 상세 회의록 (모의 데이터) */}
        <section className="w-full my-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              📘 상세 회의록
            </h2>
            <button
              type="button"
              onClick={handleCreateAIDetailed}
              className="h-9 px-3 rounded-full text-sm border border-black/10 dark:border-white/20 hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
              disabled={isDetailedLoading}
            >
              {isDetailedLoading ? "상세 생성 중..." : "상세 회의록 생성 (AI)"}
            </button>
          </div>
          {aiError && (
            <div className="mb-2 text-sm text-red-600 dark:text-red-400">
              {aiError}
            </div>
          )}
          {aiDetailedText && (
            <div className="rounded-lg border border-black/10 dark:border-white/20 p-4 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 leading-7 mb-4 whitespace-pre-wrap">
              {aiDetailedText}
            </div>
          )}
          {detailed ? (
            <div className="space-y-4">
              {/* 헤더 카드 */}
              <div className="rounded-xl border border-black/10 dark:border-white/20 p-5 bg-white dark:bg-zinc-900">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
                    {detailed.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                      📅 {detailed.date}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                      ⏰ {detailed.time}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                      📍 {detailed.location}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                      🧑‍💼 주최: {detailed.host}
                    </span>
                    {detailed.facilitator && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                        🤝 진행: {detailed.facilitator}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    회의 목적
                  </div>
                  <div className="rounded-lg border border-black/10 dark:border-white/20 bg-zinc-50 dark:bg-zinc-900 p-3 text-zinc-800 dark:text-zinc-200">
                    {detailed.objective}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                    참석자
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detailed.attendees.map((name, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full border border-black/10 dark:border-white/20 px-3 py-1 text-sm text-black dark:text-zinc-50"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 안건 카드들 */}
              <div className="space-y-3">
                {detailed.agenda.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-black/10 dark:border-white/20 p-5 bg-white dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-base font-semibold text-black dark:text-zinc-50">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        {item.decision && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 px-2.5 py-1 text-xs">
                            ✅ 결정: {item.decision}
                          </span>
                        )}
                        {item.due && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 px-2.5 py-1 text-xs">
                            ⏳ 마감: {item.due}
                          </span>
                        )}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {item.discussion.map((line, i) => (
                        <li
                          key={i}
                          className="text-sm text-zinc-800 dark:text-zinc-200 leading-6"
                        >
                          • {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-black/10 dark:border-white/20 p-6 text-sm text-zinc-600 dark:text-zinc-400">
              아직 상세 회의록이 없습니다. “상세 회의록 생성 (AI)” 버튼으로
              생성해보세요.
            </div>
          )}
        </section>

        {/* 메모 (텍스트) */}
        <section className="w-full my-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
            📝 회의 메모
          </h2>
          <MemoEditor initialContent={memoHtml} onSave={handleSaveMemo} />
        </section>

        {/* 첨부파일 */}
        <section className="w-full my-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-3">
            📎 첨부파일 (최대 100MB/파일)
          </h2>
          <div className="flex items-center gap-3 mb-3">
            <label
              htmlFor="file-input"
              className="cursor-pointer flex items-center justify-center h-10 px-4 rounded-full border border-black/10 dark:border-white/20 hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] text-sm text-black dark:text-zinc-50"
            >
              파일 업로드
            </label>
            <input
              id="file-input"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files)}
            />
          </div>
          {files.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              업로드된 파일이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {files.map((file, idx) => {
                const url = URL.createObjectURL(file);
                return (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded border border-black/10 dark:border-white/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black dark:text-zinc-50 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={url}
                        download={file.name}
                        className="h-9 px-3 rounded-full text-sm border border-black/10 dark:border-white/20 hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                      >
                        다운로드
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="h-9 px-3 rounded-full text-sm border border-black/10 dark:border-white/20 hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 웹훅 전송 */}
        <section className="w-full my-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              🔗 웹훅 전송
            </h2>
            <button
              type="button"
              onClick={handleSendWebhook}
              disabled={webhookStatus.loading}
              className="h-9 px-3 rounded-full text-sm border border-black/10 dark:border-white/20 hover:bg-black/[.04] dark:hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {webhookStatus.loading
                ? "전송 중..."
                : webhookStatus.success
                ? "전송 완료 ✓"
                : "웹훅 전송"}
            </button>
          </div>
          {webhookStatus.error && (
            <div className="mb-2 text-sm text-red-600 dark:text-red-400">
              {webhookStatus.error}
            </div>
          )}
          {webhookStatus.success && (
            <div className="mb-2 text-sm text-green-600 dark:text-green-400">
              웹훅 전송이 성공적으로 완료되었습니다.
            </div>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            메모, 요약, 상세 회의록 내용을 JSON 형태로 웹훅 URL로 전송합니다.
          </p>
        </section>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="/memo"
          >
            📝 회의 메모 시작
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
