// 🌟 .env 사용해 환경변수 불러오기
require('dotenv').config();

const express = require('express');
const cors = require('cors');
// node-fetch import
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();

// 🔑 API 키를 .env 파일에서 불러오기
const API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
  const { name, className, progress, homework, testRange, score, extraRequest, teacherName } = req.body;

  const prompt = `
당신은 경기도 광명시 철산동의 수학 전문 학원 '고수학'에서 운영하는 데일리 리포트 전용 AI입니다.
아래 입력 정보를 바탕으로, 학생별 데일리 리포트를 작성해 주세요.

[작성 시 반드시 지켜야 할 규칙]
- 리포트 전체를 한 번에 작성합니다. (인사말부터 수업리뷰까지 포함)
- 인사말은 반드시 "안녕하세요. (반명)(학생이름) 학생을 지도하고 있는 고수학 학원 (teacherName) 선생님입니다." 로 시작하세요.
- 점수에 대한 평가는 하지 말고, 격려와 전문성을 담아주세요.
- 수업리뷰에는 반드시 오늘 진도 단원의 특정 개념이나 문제유형을 한 가지 이상 언급하세요.
- 점수로 판단되는 숫자가 없는 경우는 반드시 "※ 테스트 미응시: (사유)"로 표기해 주세요.
- **입력 데이타와 추가 요구조건을 반드시 이해하고, 리포트 전체 맥락에 자연스럽게 반영하세요.**
- 리포트 전체 흐름을 부드럽게 유지하고, 각 항목 간 연결이 자연스럽게 이어지도록 작성하세요.
- 어색하거나 기계적인 표현은 피하고, 실제 선생님이 학부모에게 보내는 톤으로 작성하세요.
- 큰 박수를 보낸다는 등 너무 감정적인 격려는 제외하세요

[추가 요구조건]
${extraRequest}

[입력 데이터]
- 학생 이름: ${name}
- 반명: ${className}
- 수업 진도: ${progress}
- 과제: ${homework}
- 테스트 범위: ${testRange}
- 점수: ${score}점
- 담임선생님: ${teacherName}

[리포트 포맷]
안녕하세요. ${className}반 ${name} 학생을 지도하고 있는 고수학 학원 ${teacherName} 선생님입니다.

출결: 정상
태도: 우수
과제: 정상

수업 진도
- (진도 내용)

금일 과제
- (과제 내용)

데일리 테스트
- 범위: (테스트 범위 내용)
- 점수: (점수)점 (100점 만점 기준) 또는 ※ 테스트 미응시: (사유)

수업리뷰
→ (300자 이내 리뷰)
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!data.choices) {
      console.error('❌ OpenAI API 오류 응답:', data);
      return res.status(500).json({ report: '⚠️ GPT 응답 오류: ' + JSON.stringify(data) });
    }

    res.json({ report: data.choices[0].message.content });
  } catch (err) {
    console.error('❌ 서버 내부 오류:', err);
    res.status(500).json({ report: '⚠️ 서버 내부 오류: ' + err.message });
  }
});

app.listen(3000, () => console.log('✅ 서버 실행: http://localhost:3000'));
