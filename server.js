const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
  const { name, className, progress, homework, testRange,
          score, weakScore, extraRequest, teacherName,
          attendance, attitude, homeworkStatus } = req.body;

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateText = `${month}월 ${day}일`;

  const greeting = teacherName && teacherName.trim() !== ''
    ? `안녕하세요. ${className}반 ${name}학생을 지도하고 있는 고수학 학원 ${teacherName} 선생님 입니다. ${dateText} 데일리 리포트 입니다.`
    : `안녕하세요. 고수학 학원 입니다. ${className}반 ${name}학생의 ${dateText} 데일리 리포트 입니다.`;

const prompt = `
당신은 경기도 광명시 철산동의 수학 전문 학원 '고수학' 데일리 리포트 전용 AI입니다.
아래 정보를 바탕으로 간결한 리포트를 작성해 주세요.

[작성 규칙]
- 인사말은 반드시 아래 문장으로 시작:
${greeting}
- 출결, 태도, 과제 수행 상태를 입력값에 맞게 반영
- "수업 진도"와 "금일 과제"는 **입력란에 기록된 범위를 그대로** 표시
  (문장으로 풀어서 설명하지 마세요. 입력한 범위를 그대로 사용)
- 각 항목은 한두 줄로 간결하게 작성
- 수업리뷰는 3문장 이내로 핵심만 작성
- 테스트 범위에 월말/주간/진단 언급이 없으면 '데일리 테스트'로 작성
- 점수가 두 개면 첫 번째는 데일리 테스트 점수, 두 번째는 '취약유사: ○○점' 으로 표시
- 추가 요구조건(${extraRequest})도 자연스럽게 반영

[입력 데이터]
출결: ${attendance}
태도: ${attitude}
전날 과제 수행 상태: ${homeworkStatus}
수업 진도 범위: ${progress}
금일 과제 범위: ${homework}
테스트 범위: ${testRange}
데일리 테스트 점수: ${score ? score + '점' : '미응시'}
취약유사 점수: ${weakScore ? weakScore + '점' : '없음'}

[리포트 포맷]
안녕하세요. (선생님 이름 유무에 맞는 인사말)

출결: ○○
태도: ○○
과제 수행 상태: ○○

수업 진도: (입력된 진도 범위 그대로)
금일 과제: (입력된 과제 범위 그대로)
테스트: (테스트 종류와 점수 요약)

수업리뷰: (4문장 이내로 간단히 작성)
`;



  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
