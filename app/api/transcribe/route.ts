import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "오디오 파일이 제공되지 않았습니다." },
        { status: 400 }
      );
    }

    // AssemblyAI API 키 확인
    const assemblyApiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyApiKey) {
      return NextResponse.json(
        { error: "AssemblyAI API 키가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 1단계: 오디오 파일을 AssemblyAI에 업로드
    const uploadResponse = await fetch(
      "https://api.assemblyai.com/v2/upload",
      {
        method: "POST",
        headers: {
          authorization: assemblyApiKey,
        },
        body: await audioFile.arrayBuffer(),
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      return NextResponse.json(
        { error: `업로드 실패: ${errorData.error || "알 수 없는 오류"}` },
        { status: uploadResponse.status }
      );
    }

    const { upload_url } = await uploadResponse.json();

    // 2단계: 전사 작업 시작
    const transcriptResponse = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          authorization: assemblyApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          audio_url: upload_url,
          language_code: "ko", // 한국어 지원
        }),
      }
    );

    if (!transcriptResponse.ok) {
      const errorData = await transcriptResponse.json();
      return NextResponse.json(
        { error: `전사 시작 실패: ${errorData.error || "알 수 없는 오류"}` },
        { status: transcriptResponse.status }
      );
    }

    const { id: transcriptId } = await transcriptResponse.json();

    // 3단계: 전사 완료 대기 (폴링)
    let transcriptText = null;
    let attempts = 0;
    const maxAttempts = 60; // 최대 60초 대기

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기

      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: assemblyApiKey,
          },
        }
      );

      const statusData = await statusResponse.json();

      if (statusData.status === "completed") {
        transcriptText = statusData.text;
        break;
      } else if (statusData.status === "error") {
        return NextResponse.json(
          { error: `전사 오류: ${statusData.error || "알 수 없는 오류"}` },
          { status: 500 }
        );
      }

      attempts++;
    }

    if (!transcriptText) {
      return NextResponse.json(
        { error: "전사 작업이 시간 초과되었습니다." },
        { status: 408 }
      );
    }

    return NextResponse.json({ text: transcriptText });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "음성 변환 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

