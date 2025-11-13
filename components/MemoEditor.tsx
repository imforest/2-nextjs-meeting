"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface MemoEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  autoSaveDelay?: number;
}

export default function MemoEditor({
  initialContent = "",
  onSave,
  autoSaveDelay = 1000,
}: MemoEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!initialContent);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 자동 저장
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (content !== initialContent && onSave) {
      saveTimeoutRef.current = setTimeout(() => {
        onSave(content);
      }, autoSaveDelay);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, initialContent, onSave, autoSaveDelay]);

  // 초기 내용 설정
  useEffect(() => {
    if (initialContent && editorRef.current) {
      editorRef.current.innerHTML = initialContent;
      setContent(initialContent);
      setIsEmpty(
        !initialContent ||
          initialContent === "<br>" ||
          initialContent === "<div><br></div>"
      );
    } else if (!initialContent && editorRef.current) {
      editorRef.current.innerHTML = "";
      setContent("");
      setIsEmpty(true);
    }
  }, [initialContent]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML;
    setContent(newContent);
    setIsEmpty(
      !newContent || newContent === "<br>" || newContent === "<div><br></div>"
    );
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Ctrl/Cmd + B: 굵게
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        document.execCommand("bold", false);
        return;
      }
      // Ctrl/Cmd + I: 기울임
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        document.execCommand("italic", false);
        return;
      }
      // Ctrl/Cmd + U: 밑줄
      if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        e.preventDefault();
        document.execCommand("underline", false);
        return;
      }
    },
    []
  );

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  return (
    <div className="w-full">
      {/* 툴바 */}
      <div
        className={`
          flex items-center gap-1 p-2 mb-2 rounded-lg border transition-all duration-200
          ${
            isFocused
              ? "border-[var(--notion-border)] bg-[var(--notion-bg)] shadow-sm"
              : "border-transparent bg-transparent"
          }
        `}
      >
        <button
          type="button"
          onClick={() => applyFormat("bold")}
          className="px-3 py-1.5 rounded hover:bg-[var(--notion-hover)] text-[var(--notion-text)] hover:text-[var(--notion-text)] transition-colors text-sm font-medium"
          title="굵게 (Ctrl+B)"
        >
          <span className="font-bold">B</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat("italic")}
          className="px-3 py-1.5 rounded hover:bg-[var(--notion-hover)] text-[var(--notion-text)] hover:text-[var(--notion-text)] transition-colors text-sm italic"
          title="기울임 (Ctrl+I)"
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          onClick={() => applyFormat("underline")}
          className="px-3 py-1.5 rounded hover:bg-[var(--notion-hover)] text-[var(--notion-text)] hover:text-[var(--notion-text)] transition-colors text-sm"
          title="밑줄 (Ctrl+U)"
        >
          <span className="underline">U</span>
        </button>
        <div className="w-px h-6 bg-[var(--notion-border)] mx-1" />
        <button
          type="button"
          onClick={() => applyFormat("insertUnorderedList")}
          className="px-3 py-1.5 rounded hover:bg-[var(--notion-hover)] text-[var(--notion-text)] hover:text-[var(--notion-text)] transition-colors text-sm"
          title="글머리 기호 목록"
        >
          • 목록
        </button>
        <button
          type="button"
          onClick={() => applyFormat("insertOrderedList")}
          className="px-3 py-1.5 rounded hover:bg-[var(--notion-hover)] text-[var(--notion-text)] hover:text-[var(--notion-text)] transition-colors text-sm"
          title="번호 목록"
        >
          1. 목록
        </button>
      </div>

      {/* 에디터 */}
      <div className="relative">
        {isEmpty && !isFocused && (
          <div
            className="absolute top-6 left-6 pointer-events-none text-[var(--notion-text-secondary)] opacity-50"
            style={{
              fontFamily:
                'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: "15px",
            }}
          >
            회의 내용을 자유롭게 작성하세요...
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            min-h-[400px] w-full p-6 rounded-lg border-2 transition-all duration-200
            bg-[var(--notion-bg)] text-[var(--notion-text)]
            ${
              isFocused
                ? "border-[var(--notion-blue)] shadow-md outline-none"
                : "border-[var(--notion-border)] hover:border-[var(--notion-text-secondary)]"
            }
            focus:outline-none
            [&>p]:mb-2 [&>p]:leading-7 [&>p]:text-[var(--notion-text)]
            [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-2 [&>ul]:space-y-1 [&>ul]:text-[var(--notion-text)]
            [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-2 [&>ol]:space-y-1 [&>ol]:text-[var(--notion-text)]
            [&>li]:mb-1 [&>li]:text-[var(--notion-text)]
            [&>strong]:font-semibold [&>strong]:text-[var(--notion-text)]
            [&>em]:italic [&>em]:text-[var(--notion-text)]
            [&>u]:underline [&>u]:text-[var(--notion-text)]
          `}
          style={{
            fontFamily:
              'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: "15px",
            lineHeight: "1.6",
            color: "var(--notion-text)",
          }}
          suppressContentEditableWarning
        />
      </div>

      {/* 자동 저장 표시 */}
      {isFocused && (
        <div className="mt-2 text-xs text-[var(--notion-text-secondary)] flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>자동 저장 중...</span>
        </div>
      )}
    </div>
  );
}
