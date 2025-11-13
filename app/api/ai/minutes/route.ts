import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set in environment (.env.local)" },
        { status: 500 }
      );
    }
    const body = await req.json();
    const transcript = body?.transcript as string;
    const meta = (body?.meta ?? {}) as {
      title?: string;
      objective?: string;
      attendees?: string[];
    };
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const title = meta.title ?? "회의";
    const objective = meta.objective ?? "회의 목적";
    const attendees = Array.isArray(meta.attendees) ? meta.attendees : [];
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const summaryMessages = [
      {
        role: "system" as const,
        content: "너는 한국어 회의록 전문가야. 간결하고 핵심 위주로 요약해줘.",
      },
      {
        role: "user" as const,
        content: `
다음 회의 전체 내용을 핵심 주제별로 3~5개 포인트로 요약해줘. 
- 중요한 결정 사항과 액션 아이템은 반드시 포함
- 불필요한 수사는 생략

[회의 제목] ${title}
[회의 목적] ${objective}
[참석자] ${attendees.join(", ") || "N/A"}

[회의 전체 내용]
${transcript}
`,
      },
    ];

    const detailedMessages = [
      {
        role: "system" as const,
        content:
          "너는 한국어 회의록 전문가야. 읽기 쉬운 구조로 상세 회의록을 작성해줘.",
      },
      {
        role: "user" as const,
        content: `
아래 형식으로 상세 회의록을 작성해줘.
- 메타: 회의명, 목적, 참석자(배지화하기 좋은 짧은 이름)
- 안건 리스트: 각 안건 제목, 핵심 논의(불릿), '결정', '마감' 뱃지로 표시할 수 있도록 명확한 문장
- 표 형식은 피하고, 섹션/뱃지/불릿 위주로

[회의 제목] ${title}
[회의 목적] ${objective}
[참석자] ${attendees.join(", ") || "N/A"}

[회의 전체 내용]
${transcript}
`,
      },
    ];

    const [summaryRes, detailedRes] = await Promise.all([
      client.chat.completions.create({
        model,
        messages: summaryMessages,
        temperature: 0.3,
      }),
      client.chat.completions.create({
        model,
        messages: detailedMessages,
        temperature: 0.3,
      }),
    ]);

    const summary = summaryRes.choices?.[0]?.message?.content?.trim?.() ?? "";
    const detailed = detailedRes.choices?.[0]?.message?.content?.trim?.() ?? "";

    return NextResponse.json({ summary, detailed });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "AI error" },
      { status: 500 }
    );
  }
}
