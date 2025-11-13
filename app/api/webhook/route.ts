import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_URL = "https://hook.eu1.make.com/kxxvc3fmcjvtuug784ngsgj5qt5146vq";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Make.com 웹훅은 일반적으로 200 OK를 반환하지만, 
    // 410은 웹훅이 만료되었거나 비활성화된 경우입니다.
    // 재시도 로직과 함께 더 자세한 에러 정보를 제공합니다.
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Next.js-Webhook-Client",
      },
      body: JSON.stringify(body),
    });

    // 응답 본문 읽기 시도
    let errorMessage = "";
    let responseText = "";
    try {
      responseText = await response.text();
      if (responseText) {
        try {
          const responseJson = JSON.parse(responseText);
          errorMessage =
            responseJson.message ||
            responseJson.error ||
            responseJson.details ||
            responseText;
        } catch {
          errorMessage = responseText.substring(0, 200); // 처음 200자만
        }
      }
    } catch {
      // 응답 본문 읽기 실패 시 무시
    }

    if (!response.ok) {
      // 410 에러의 경우 특별한 메시지 제공
      if (response.status === 410) {
        return NextResponse.json(
          {
            error: "웹훅 URL이 만료되었거나 비활성화되었습니다 (410 Gone)",
            details:
              errorMessage ||
              "웹훅 URL을 확인하고 Make.com에서 새로운 웹훅 URL을 생성해주세요.",
            status: 410,
          },
          { status: 410 }
        );
      }

      return NextResponse.json(
        {
          error: `웹훅 전송 실패: ${response.status} ${response.statusText}`,
          details: errorMessage || `HTTP ${response.status} 에러가 발생했습니다.`,
          status: response.status,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "웹훅 전송 중 오류가 발생했습니다.",
        details: e?.message || "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

