// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

// --- CORS 옵션 (모든 출처 허용 + 필요한 헤더/메서드 허용) ---
const corsOptions = {
  origin: '*', // 특정 도메인만 허용하려면 '*' 대신 ['https://example.com'] 식으로 지정
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
app.use(cors(corsOptions));
// 프리플라이트 일괄 처리
app.options('*', cors(corsOptions));

// 혹시 모를 누락 대비: 응답에 직접 헤더 추가
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// 바디 파서
app.use(express.json());

// 헬스체크 (Render/모니터링용)
app.get('/health', (req, res) => res.status(200).send('ok'));

app.post('/generate', async (req, res) => {
  const {
    name, className, progress, homework, testRange,
    score, weakScore, extraRequest, teacherName,
    attendance, attitude, homeworkStatus
  } = req.body;

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateText = `${month}월 ${day}일`;

  const greeting = teacherName && teacherName.trim() !== ''
    ? `안녕하세요. ${className}반 ${name}학생을 지도하고 있는 고수학 학원 ${teacherName} 선생님 입니다. ${dateText} 데일리 리포트 입니다.`
    : `안녕하세요. 고수학 학원 입니다. ${className}반 ${name}학생의 ${dateText} 데일리 리포트 입니다.`;

  const prompt = `
당신은 경기도 광명시 철산동의 수학 전문 학원 '고수학' 데일리 리포트 전용 AI입니다.
아래 정보를 바탕으로 **간결하고 핵심만 요약한 리포트**를 작성해 주세요.

[작성 규칙]
- 인사말은 반드시 아래 문장으로 시작:
${greeting}
- 각 항목은 한두 줄로만 간결하게 작성
- 불필요한 장황한 설명은 제거
- 수업리뷰는 3문장 이내로 핵심만
- 학생의 태도나 출결, 과제 상태는 간단히 명시
- 테스트 점수와 취약유사 점수는 함께 표시
- 진도에서 한 가지 개념을 구체적으로 언급

[입력 데이터]
출결: ${attendance}
태도: ${attitude}
과제: ${homeworkStatus}
수업 진도: ${progress}
과제 내용: ${homework}
테스트 범위: ${testRange}
데일리 테스트 점수: ${score ? score + '점' : '미응시'}
취약유사 점수: ${weakScore ? weakScore + '점' : '없음'}
추가 요구조건: ${extraRequest}

[리포트 포맷]
안녕하세요. (선생님 이름 유무에 맞는 인사말) 

출결: ○○
태도: ○○
과제: ○○

진도: (한 줄)
과제: (한 줄)
테스트: (테스트 종류와 점수 요약)

수업리뷰: (3문장 이내로 간단히 작성)
`;

  try {
    // OpenAI 호출
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000); // 30s 타임아웃

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
    }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(502).json({ report: `⚠️ OpenAI 호출 실패: HTTP ${response.status} ${response.statusText} ${text.slice(0,200)}` });
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ report: '⚠️ GPT 응답 형식 오류' });
    }

    // CORS 헤더가 에러 응답에도 계속 붙도록 보장 (위의 전역 미들웨어가 처리)
    res.json({ report: data.choices[0].message.content });
  } catch (err) {
    const msg = err?.name === 'AbortError' ? '요청 시간 초과' : (err?.message || String(err));
    res.status(500).json({ report: '⚠️ 서버 내부 오류: ' + msg });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 서버 실행: http://localhost:${PORT}`));

