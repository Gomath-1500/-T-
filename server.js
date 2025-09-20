// server.js  (Node 18+)
// 1) npm i express cors dotenv node-fetch
// 2) .env 에 OPENAI_API_KEY=sk-... 넣기  (따옴표 없이)
// 3) node server.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();

// --- CORS/프리플라이트 ---
app.use(cors({ origin: true }));
app.options('*', cors());

// --- 바디파서 ---
app.use(express.json({ limit: '1mb' }));

// --- 유틸 ---
function to100(score, base) {
  const n = Number(score), b = Number(base);
  if (!Number.isFinite(n)) return '';
  if (Number.isFinite(b) && b > 0) return Math.max(0, Math.min(100, Math.round((n / b) * 100)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

// --- 헬스체크: 환경 및 네트워크 점검 ---
app.get('/health', async (req, res) => {
  const hasKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'));
  res.status(200).json({
    ok: true,
    node: process.version,
    hasKey,
    model: 'gpt-4o',
    time: new Date().toISOString(),
  });
});

// --- 메인: GPT 리포트 생성 ---
app.post('/generate', async (req, res) => {
  const {
    name, className, progress, homework, testRange,
    score, base, teacherName, dateStr,
    attendance = '정상', attitude = '우수', homeworkStatus = '정상',
    testReason = '', notice = ''
  } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ report: '⚠️ 서버: OPENAI_API_KEY 누락', detail: '환경변수 설정 필요' });
  }

  const pct = score && base ? to100(score, base) : '';

  const system = `
너는 경기도 광명시 철산동의 수학 전문 학원 '고수학'의 데일리 리포트 전용 AI다.
항상 신뢰감 있고 공손한 존댓말을 쓰고, 아래 형식과 규칙을 엄격히 지켜라.

[형식]
안녕하세요. 고수학 학원입니다. {날짜} {반명} {학생}학생의 학습 안내입니다.

출결: {출결}
태도: {태도}
과제: {과제}

수업 진도
- {반명}: {진도}

금일 과제
- {반명}: {과제내용}

데일리 테스트
- 범위: {테스트범위}
- 점수: {점수표기 또는 미기재}
{미응시줄}

수업리뷰
문장마다 줄바꿈.
점수 평가는 지양하고, 수업 내용과 연계된 학습 방향과 의지를 중심으로 약 250자 이내로 작성.
리포트에 언급된 단원 중 하나의 수학 개념이나 문제 유형을 구체적으로 최소 한 가지 반영.
문장은 모두 “습니다/하셨습니다”로 끝남.
화살표나 점(·) 등 특수문자 사용하지 않음.

{공지줄}
담당: {담당자 또는 생략}

[고정 규칙]
- 점수는 항상 100점 만점 기준으로 표기.
- 테스트 미응시 시 “※ 테스트 미응시: (사유)” 줄을 반드시 추가하고, 리뷰에서도 간단히 언급.
- 난이도 표기는 생략.
- 불필요한 말은 넣지 않음.
`;

  const testTaken = !!pct;
  const scoreLine = testTaken ? `${pct}점 (100점 만점 기준)` : `미기재`;
  const noTestLine = testTaken ? `` : `- ※ 테스트 미응시: ${testReason || (String(attendance).includes('결석') ? '결석' : '수업 시간 내 미진행')}`;
  const noticeLine = notice ? `공지사항\n- ${notice}` : ``;

  const user = `
[입력]
- 날짜: ${dateStr}
- 반명: ${className}
- 학생: ${name}
- 출결/태도/과제: ${attendance} / ${attitude} / ${homeworkStatus}
- 진도: ${progress}
- 과제내용: ${homework}
- 테스트범위: ${testRange}
- 점수: ${score ?? ''} / 분모: ${base ?? ''}
- 점수표기(100점 환산): ${scoreLine}
- 미응시여부: ${testTaken ? '아니오' : '예'} / 사유: ${testReason || '없음'}
- 공지: ${notice || '없음'}
- 담당자: ${teacherName || ''}

위 시스템 지침의 [형식]과 [고정 규칙]을 정확히 지켜 최종 리포트를 완성해 주세요.
`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        report: '⚠️ GPT 오류',
        status: r.status,
        statusText: r.statusText,
        openai_error: data?.error || null
      });
    }

    if (!data?.choices?.[0]?.message?.content) {
      return res.status(500).json({ report: '⚠️ GPT 응답 형식 오류', raw: data });
    }

    res.json({ report: data.choices[0].message.content });
  } catch (e) {
    console.error('서버 내부 오류:', e);
    res.status(500).json({ report: '⚠️ 서버 내부 오류', detail: String(e?.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 서버 실행: http://localhost:${PORT}`));
