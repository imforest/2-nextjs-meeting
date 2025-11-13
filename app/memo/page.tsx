"use client";

import { useState, useEffect } from "react";
import MemoEditor from "@/components/MemoEditor";
import AudioRecorder from "@/components/AudioRecorder";

export default function MemoPage() {
  const [memoContent, setMemoContent] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // 로컬 스토리지에서 메모 불러오기
  useEffect(() => {
    const savedMemo = localStorage.getItem("meeting-memo");
    const savedTitle = localStorage.getItem("meeting-title");

    if (savedMemo) {
      setMemoContent(savedMemo);
    }
    if (savedTitle) {
      setMeetingTitle(savedTitle);
    }

    const lastSaved = localStorage.getItem("memo-saved-at");
    if (lastSaved) {
      setSavedAt(new Date(lastSaved));
    }
  }, []);

  // 메모 자동 저장
  const handleSaveMemo = (content: string) => {
    localStorage.setItem("meeting-memo", content);
    const now = new Date();
    localStorage.setItem("memo-saved-at", now.toISOString());
    setSavedAt(now);
  };

  // 제목 저장
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setMeetingTitle(newTitle);
    localStorage.setItem("meeting-title", newTitle);
  };

  // 음성 변환 텍스트를 메모에 추가
  const handleTranscript = (text: string) => {
    if (text.trim()) {
      const timestamp = new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      // HTML 형식으로 추가
      const timestampHtml = `<p><strong>[${timestamp}]</strong> ${text.replace(
        /\n/g,
        "<br>"
      )}</p>`;
      const currentHtml = memoContent || "";
      const newContent = currentHtml
        ? `${currentHtml}\n${timestampHtml}`
        : timestampHtml;
      setMemoContent(newContent);
      localStorage.setItem("meeting-memo", newContent);

      // 저장 시간 업데이트
      const now = new Date();
      localStorage.setItem("memo-saved-at", now.toISOString());
      setSavedAt(now);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--notion-bg)" }}
    >
      {/* 헤더 */}
      <header
        className="sticky top-0 z-10 border-b shadow-sm"
        style={{
          backgroundColor: "var(--notion-bg)",
          borderColor: "var(--notion-border)",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--notion-text)" }}
            >
              회의 메모
            </h1>
            {savedAt && (
              <span
                className="text-sm"
                style={{ color: "var(--notion-text-secondary)" }}
              >
                마지막 저장: {savedAt.toLocaleTimeString("ko-KR")}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 제목 입력 */}
        <div className="mb-8">
          <input
            type="text"
            value={meetingTitle}
            onChange={handleTitleChange}
            placeholder="회의 제목을 입력하세요..."
            className="w-full text-3xl font-bold bg-transparent border-none outline-none pb-2 border-b-2 border-transparent transition-colors placeholder:opacity-50"
            style={{
              fontFamily:
                'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              color: "var(--notion-text)",
              borderBottomColor: "transparent",
            }}
            onFocus={(e) => {
              e.target.style.borderBottomColor = "var(--notion-border)";
            }}
            onBlur={(e) => {
              e.target.style.borderBottomColor = "transparent";
            }}
          />
        </div>

        {/* 날짜 및 시간 */}
        <div
          className="mb-6 text-sm"
          style={{ color: "var(--notion-text-secondary)" }}
        >
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}{" "}
          ·{" "}
          {new Date().toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        {/* 음성 녹음 */}
        <div className="mb-6">
          <AudioRecorder onTranscript={handleTranscript} />
        </div>

        {/* 메모 에디터 */}
        <div
          className="rounded-xl shadow-sm border p-6"
          style={{
            backgroundColor: "var(--notion-bg)",
            borderColor: "var(--notion-border)",
          }}
        >
          <MemoEditor
            key={memoContent} // 내용이 변경되면 리렌더링
            initialContent={memoContent}
            onSave={handleSaveMemo}
            autoSaveDelay={1000}
          />
        </div>

        {/* 안내 텍스트 */}
        <div
          className="mt-6 p-4 rounded-lg border"
          style={{
            backgroundColor: "var(--notion-blue-light)",
            borderColor: "var(--notion-blue)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--notion-blue)" }}>
            <strong>💡 팁:</strong> 키보드 단축키를 사용하세요 -{" "}
            <kbd
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: "rgba(11, 133, 255, 0.2)" }}
            >
              Ctrl+B
            </kbd>{" "}
            (굵게),{" "}
            <kbd
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: "rgba(11, 133, 255, 0.2)" }}
            >
              Ctrl+I
            </kbd>{" "}
            (기울임),{" "}
            <kbd
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ backgroundColor: "rgba(11, 133, 255, 0.2)" }}
            >
              Ctrl+U
            </kbd>{" "}
            (밑줄)
          </p>
        </div>
      </main>
    </div>
  );
}
