# Vercel 배포 가이드

## 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정해야 합니다:

1. **Vercel 대시보드 접속**

   - 프로젝트 선택 → Settings → Environment Variables

2. **필수 환경 변수 추가**

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
   ```

   **참고**: AssemblyAI API 키는 음성 변환 기능에 필요합니다.
   사용하지 않는 경우 `/api/transcribe` 라우트를 제거하거나
   환경 변수 없이도 동작하도록 수정할 수 있습니다.

3. **환경 적용**
   - Production, Preview, Development 모두에 적용

## 배포 후 확인 사항

1. **빌드 로그 확인**

   - Vercel 대시보드 → Deployments → 최신 배포 클릭 → Build Logs 확인

2. **런타임 에러 확인**

   - Functions 탭에서 API 라우트 에러 확인

3. **환경 변수 확인**
   - Settings → Environment Variables에서 변수가 제대로 설정되었는지 확인

## 문제 해결

### 404 에러 발생 시

1. 환경 변수가 설정되었는지 확인
2. 빌드가 성공했는지 확인
3. 브라우저 콘솔에서 에러 확인

### API 라우트 에러 시

- `/api/ai/minutes` - OPENAI_API_KEY 필요
- `/api/transcribe` - AssemblyAI API 키 필요 (사용 중인 경우)
- `/api/webhook` - 웹훅 URL은 코드에 하드코딩되어 있음
