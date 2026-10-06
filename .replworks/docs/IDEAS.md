# ClayTube — 아이디어

## 핵심 아이디어

ClayTube는 YouTube 채널을 브랜드화된 정적 영상 사이트로 만들어주는 오픈소스 CLI 도구다.

핵심 개념은 다음과 같다.

> YouTube를 콘텐츠 소스 / CMS로 사용하고, ClayTube가 해당 콘텐츠를 별도의 편집형 영상 포털로 생성한다.

ClayTube는 YouTube를 대체하지 않는다. YouTube 위에 브랜드화된 콘텐츠 사이트를 만드는 도구다.

---

## 제품

### ClayTube란?

YouTube 채널들을 모아 하나의 영상 포털을 만드는 도구.

ClayTube의 핵심은 단순한 YouTube 채널 모음이 아니라, YouTube 콘텐츠를 자신의 브랜드를 가진 콘텐츠 사이트로 재구성하는 것이다.

### 사용 사례

* 교육 콘텐츠 포털
* 학원 영상 사이트
* 팬 커뮤니티
* 기업 미디어 허브
* 정부기관 큐레이션 페이지

### 가치

* YouTube를 CMS처럼 사용
* 브랜드화된 사이트 생성
* 자동 업데이트

---

## 아키텍처

ClayTube는 서버 없이 운영 가능한 영상 포털 생성을 목표로 한다.

```text
claytube.config.yaml
   ↓
YouTube API 호출
   ↓
정규화
   ↓
data/channels.json
data/videos.json
   ↓
Astro 템플릿
   ↓
정적 빌드
   ↓
dist/
   ↓
GitHub Pages
```

* 백엔드 없음
* 데이터베이스 없음
* 정적 사이트를 기본으로 함

---

## 운영 원칙

### CLI 우선

모든 작업은 command로 실행한다.

사용자는 소스 코드를 수정하지 않고 사이트를 생성하고 publish할 수 있어야 한다.

### 정적 사이트 우선

최종 결과물은 정적 사이트여야 한다.

### 설정 기반

YouTube URL과 설정만으로 사이트를 생성한다.

### 변경 시 다시 빌드

새 영상이 발견되면 자동으로 다시 빌드한다.

### 유지보수 최소화

운영 부담을 최소화한다.

---

## CLI

ClayTube는 CLI-first 방식이다.

### `claytube init`

새 프로젝트를 생성한다.

```bash
claytube init my-site
claytube init my-site --git
```

생성되는 구조:

```text
my-site/
  claytube.config.yaml
  data/
    channels.json
    videos.json
  src/
  astro.config.mjs
  package.json
```

### 채널 추가

`claytube.config.yaml`에 YouTube 채널 URL을 추가한다.

```yaml
channels:
  - https://youtube.com/@cable8mm
  - https://youtube.com/@MITOpenCourseWare
```

### `claytube sync`

YouTube API를 호출하여 최신 YouTube 메타데이터를 가져온다.

```bash
claytube sync
```

업데이트:

* `data/channels.json`
* `data/videos.json`

### `claytube build`

정적 사이트를 생성한다.

```bash
claytube build
```

출력:

```text
dist/
```

### `claytube deploy`

GitHub Pages에 publish한다.

```bash
claytube deploy
```

### 옵션

#### `--config`

설정 파일을 지정한다.

```bash
claytube sync --config my.yaml
```

#### `--dry-run`

변경 내용을 확인하고 실제 파일은 수정하지 않는다.

```bash
claytube sync --dry-run
```

### 오류

예시:

* 잘못된 YouTube URL
* API 키 없음
* 빌드 실패

---

## 데이터 모델

```text
data/
  channels.json
  videos.json
```

### channels.json

```json
{
  "channels": [
    {
      "id": "",
      "title": "",
      "url": "",
      "thumbnail": ""
    }
  ]
}
```

### videos.json

```json
{
  "videos": [
    {
      "id": "",
      "title": "",
      "channelId": "",
      "publishedAt": "",
      "thumbnail": "",
      "url": ""
    }
  ]
}
```

---

## 디자인

### 참고

TED.com

### 원칙

* 큰 썸네일
* 깔끔한 타이포그래피
* 편집형 레이아웃
* 콘텐츠 중심
* 최소한의 UI

### 피할 것

* 대시보드 같은 디자인
* 복잡함
* 과도한 필터

---

## 설정

`claytube.config.yaml`

예시:

```yaml
site:
  title: My Channel Hub

channels:
  - https://youtube.com/@cable8mm
  - https://youtube.com/@mit
```

---

## 로드맵

### v1

* 채널 동기화
* video.json
* 정적 홈페이지
* 배포

### v2

* 검색
* 태그
* 플레이리스트

### v3

* 커뮤니티 기능

---

## 수익화

ClayTube는 오픈소스 CLI 제품이다.

소프트웨어 자체는 무료이며, 수익은 서비스, 커스터마이징, 관리형 호스팅을 통해 발생한다.

### 무료 오픈소스 CLI

ClayTube는 계속 무료로 사용할 수 있어야 한다.

포함:

* `claytube init`
* `claytube sync`
* `claytube build`
* 기본 테마
* GitHub Pages 배포 지원

목적:

* 진입 장벽을 낮춤
* 신뢰 구축
* 인바운드 관심 유도
* 쇼케이스 사례 생성

### 유료 서비스

#### A. 구축 서비스

ClayTube를 사용하고 싶지만 직접 설정하기를 원하지 않는 고객을 대상으로 한다.

예시:

* GitHub 저장소 설정
* YouTube 채널 설정
* 도메인 연결
* 초기 배포

예상 가격:

* 30만 ~ 50만 원

#### B. 프리미엄 테마 커스터마이징

조직이나 크리에이터를 위한 맞춤 디자인 작업.

예시:

* 브랜드 색상
* 맞춤 홈페이지 레이아웃
* 맞춤 내비게이션
* 타이포그래피 조정

예상 가격:

* 15만 ~ 100만 원

#### C. 관리형 ClayTube 호스팅

구독 기반 서비스.

ETERN이 관리:

* 저장소 업데이트
* GitHub Actions
* YouTube API 키
* 배포 모니터링
* 문제 해결

예상 가격:

* 월 29,000원
* 월 99,000원 (조직)

#### D. 기관 / 정부 프로젝트

고부가가치 서비스 영역.

대상 고객:

* 창업지원센터
* 대학
* 교육기업
* 지방자치단체
* 사내 기업 교육 포털

일반적인 서비스:

* 큐레이션 학습 포털
* 브랜드화된 배포
* 콘텐츠 구성
* 장기 유지보수

가격:

* 프로젝트 기반 컨설팅

---

## 전략적 포지셔닝

ClayTube는 주된 소프트웨어 판매 사업이 아니다.

ClayTube는 다음의 역할을 한다.

* 오픈소스 제품
* 리드 생성 도구
* 신뢰도 구축 수단
* 반복해서 활용할 수 있는 구축 엔진

수익은 다음에서 발생한다.

* 구축
* 커스터마이징
* 유지보수
* 컨설팅

---

## 성공 지표

### 주요 KPI

* 활성 ClayTube 사이트 수

### 보조 KPI

* 인바운드 서비스 문의
* 유료 구축 전환율
* 반복 결제하는 관리형 호스팅 고객 수
