# 실습함 데모

Codex 데스크톱에서 **실습 시작 → 채팅에서 만들기 → 제출 → 결과물과 공유 대화 보기**를 체험하는 데모입니다.

**Node.js 별도 설치 불필요.** Windows용 실행 파일과 Mac용 실행 환경을 패키지에 포함했습니다. 첫 다운로드 용량은 마켓플레이스 전체 기준 약 200MB입니다. 공개 OpenAI 디렉터리 등록 제품이 아닌 GitHub 기반 테스트 마켓플레이스입니다.

## 설치

Codex CLI가 사용 가능한 터미널에서 실행합니다. 명령을 찾을 수 없다면 Codex 데스크톱에서 CLI 설치를 먼저 완료하거나, 아래 두 명령의 실행을 Codex 채팅에 요청하세요.

### Windows (x64)

```powershell
codex plugin marketplace add awoeirj/class-inbox-demo
codex plugin add class-inbox-demo-windows@classroom-demo
```

### Mac (Apple Silicon / Intel)

```sh
codex plugin marketplace add awoeirj/class-inbox-demo
codex plugin add class-inbox-demo-mac@classroom-demo
```

자신의 OS에 해당하는 플러그인 **하나만** 설치하세요. 설치 후 사이드바의 앱 목록(더보기 `…`)에서 **실습함**을 엽니다. 사이드바에 항목이 나타나지 않으면 플러그인 로딩 실패일 수 있습니다. `0.2.0`을 설치했다면 아래 업데이트 명령 후 다시 설치하세요. `0.2.1`에서 설치 경로 해석 오류를 수정했습니다. 앱의 플러그인 실행·연결 확인이 표시되면 내용을 확인하세요. Windows ARM 네이티브 패키지는 제공하지 않습니다.

## 5분 체험

1. **받은 실습**에서 `01 · 고객 문의 답변 만들기`를 엽니다.
2. **이 실습 시작**을 누르면 새 채팅에 과제 내용을 전송합니다.
3. 답변의 말투나 길이를 수정하고 “이 답변으로 제출해”라고 요청합니다.
4. 닉네임·결과물·공유할 대화를 확인한 후 제출합니다. 전체 세션을 자동 추출하지 않습니다.
5. **우리 반 결과물**에서 결과물과 **만든 과정 보기**를 확인합니다.
6. 두 번째 과제 `02 · 행사 안내 페이지 만들기`로 이미지·HTML 파일 제출 예시를 확인합니다.

화면에서 직접 제출하려면 **우리 반 결과물 → 결과물 제출**을 이용하세요. 글·이미지·파일·HTTP(S) 링크를 묶을 수 있습니다. 파일당 5MB, 한 제출물 약 10MB 제한입니다. 실습과 제출물은 휴지통에서 복구할 수 있습니다.

## 데모 범위와 데이터

- 예시 학생·대화·행사는 모두 가상입니다. 처음 실행할 때 과제 2개와 가상 제출물 2개를 한 번 넣습니다.
- 데이터는 **본인 컴퓨터에만** 저장됩니다. 다른 설치 사용자, 강사, 저장소 운영자에게 전송하지 않습니다.
- Supabase, 외부 수업 서버, 로그인, 실제 반별 공유는 연결되어 있지 않습니다.
- **과제 시작**은 자동 전송입니다. 실제 모델 실행은 본인의 Codex 계정과 사용 한도를 이용합니다.
- 다른 사용자의 제출물을 지우는 권한 체계는 구현되어 있지 않습니다. 현재는 각자 독립된 데모 저장소입니다.
- 기존 개발용 실습함과 데이터가 분리되어 있습니다.
- 이미지 미리보기 이외 PDF·PPT·코드는 파일 다운로드로 제공합니다.

저장 위치: Windows `%LOCALAPPDATA%\ClassInboxDemo`, Mac `~/Library/Application Support/ClassInboxDemo`. Mac 런타임은 최초 실행 시 `~/Library/Caches/ClassInboxDemo`에 압축 해제합니다. 플러그인 제거만으로 데이터가 자동 삭제되지는 않습니다.

## 업데이트 / 제거

```sh
codex plugin marketplace upgrade classroom-demo
```

업데이트 후 해당 OS의 `codex plugin add ...` 명령을 다시 실행하세요. 실행 중인 앱에서 반영되지 않으면 앱을 다시 시작해 사이드바의 실습함을 확인하세요. 제거는 Codex 플러그인 관리 화면에서 할 수 있습니다.

## 개발 및 검증

`source/`는 원본 코드, `plugins/`는 의존성까지 번들된 설치 패키지입니다. 패키지는 npm 설치 없이 실행됩니다. 개발할 때만 Node.js 22.17 이상과 npm이 필요합니다.

```sh
npm ci
npm run build
npm test
node scripts/smoke.mjs plugins/class-inbox-demo-mac
```

Windows에서는 마지막 경로를 `plugins/class-inbox-demo-windows`로 바꿉니다. smoke 검사는 서버 PATH에서 Node.js를 제거한 상태로 번들 런타임을 실행합니다.

Node.js v24.22.2 공식 배포본을 포함합니다. 원본 체크섬은 `RUNTIME-CHECKSUMS.txt`, Node 및 제3자 라이선스는 각 패키지의 `runtime/NODE-LICENSE.txt`와 `THIRD-PARTY-LICENSES.txt`에 있습니다.
