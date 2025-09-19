const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

/* ===== CORS (전역) ===== */
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ===== 파서 ===== */
app.use(express.json({ limit: '1mb' }));

/* ===== 유틸 (기존 코드와 동일) ===== */
function kstMonthDay() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  return `${mm}월 ${dd}일`;
}

/* ===== Gemini 연동 및 호출 ===== */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // 비용 및 속도 고려하여 flash 모델 사용

// 단일 호출 함수 (재시도 로직은 별도 라이브러리 또는 구현 필요)
async function fetchGeminiReport(prompt) {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/* ===== 프롬프트 빌더 (기존 코드와 동일) ===== */
function buildPrompt(payload) {
  const {
    name = '', className = '', progress = '', homework = '',
    testRange = '', score = '', weakScore = '', attendance = '정상',
    attitude = '우수', homeworkStatus = '정상', teacherName = '',
    dateStr = kstMonthDay(), notice = '', lengthMode = 'standard',
    scoreFormat = 'int', includeClass = true, includeTeacher = false, testReason = '',
  } = payload || {};

  //... (기존 buildPrompt 함수 내용 그대로)
  const greetHead = includeTeacher && teacherName
    ? `고수학 학원(담당: ${teacherName})`
    : '고수학 학원';

  const greetMid = includeClass
    ? `${dateStr} ${className} ${name}학생의 학습 안내입니다.`
    : `${dateStr} ${name}학생의 학습 안내입니다.`;

  const lenGuide = (lengthMode === 'short')
    ? '수업리뷰는 2문장 내외로 간결하게 작성합니다.'
    : (lengthMode === 'long'
        ? '수업리뷰는 5~7문장 내외로 조금 자세히 작성합니다.'
        : '수업리뷰는 3~5문장 내외로 표준 길이로 작성합니다.');

  const scGuide = (scoreFormat === 'one')
    ? '점수는 한 자리 소수로 표시합니다.'
    : '점수는 정수로 반올림해 표시합니다.';

  const testTaken = (typeof score === 'string' && score.trim() !== '') || (typeof score === 'number' && !isNaN(score));
  const testScoreLine = testTaken
    ? `- 점수: ${score}점 (100점 만점 기준)`
    : `- 점수: 미기재\n- ※ 테스트 미응시: ${testReason || (attendance.includes('결석') ? '결석' : '사유 미기재')}`;

  return {
    system: `
너는 경기도 광명시 철산동의 수학 전문 학원 '고수학' 데일리 리포트 작성 전용 AI다.
아래 '출력 형식'과 '작성 원칙'을 반드시 지켜라.
[출력 형식]
안녕하세요. ${greetHead}입니다. ${greetMid}

출결: ${attendance}
태도: ${attitude}
과제: ${homeworkStatus}

수업 진도
- ${className}: (입력된 진도 요약 1~2줄)

금일 과제
- ${className}: (입력된 과제 요약 1~2줄)

데일리 테스트
- 범위: ${testRange}
${testScoreLine}

수업리뷰
- 학생의 태도, 개념 이해, 문제 해결력, 실수 보완 여부 등을 바탕으로 ${lengthMode==='short'?'약 100자':'약 250자'} 이내 피드백을 작성한다.
- 학생의 점수에 대한 평가는 지양하고, 수업 내용과 연계된 선생님의 학습 방향과 의지를 중심으로 서술한다.
- 테스트 미응시 시 관련 내용을 반드시 언급한다.
- 반별 공지사항(notice)이 있으면 마지막에 1줄로 덧붙인다.
- 반드시 리포트에 언급된 단원 중 하나의 **수학 개념 또는 문제유형**을 1가지 이상 구체적으로 반영한다.
- 문장은 모두 존댓말(…습니다/…하였습니다)로 끝내고, 문장마다 줄바꿈하여 가독성을 높인다.
- 화살표(→), 중점(·) 등의 특수문자를 사용하지 않는다.
[작성 원칙]
- “안녕하세요. 고수학 학원입니다.”로 시작하는 인사말을 유지한다.
- 점수는 항상 100점 기준으로 표기한다(원시점수라는 표현 금지).
- ${lenGuide}
- ${scGuide}
- 난이도 표기는 생략한다.
- 내용은 해당 학생 개인만을 위한 리뷰로 작성한다.
`.trim(),
    user: `
[입력 데이터]
반명: ${className}
학생: ${name}
출결: ${attendance}
태도: ${attitude}
과제 상태: ${homeworkStatus}
수업 진도: ${progress}
금일 과제: ${homework}
테스트 범위: ${testRange}
테스트 점수(100점 기준): ${testTaken ? `${score}점` : '미응시'}
취약유사 점수: ${weakScore || '없음'}
공지사항: ${notice || '없음'}
[주의]
- 위의 '출력 형식'과 '작성 원칙'을 **그대로** 지켜서 하나의 리포트를 완성하세요.
- 출력에는 불릿 기호 외 특수문자를 쓰지 마세요.
`.trim()
  };
}

/* ===== 라우트 ===== */
app.get('/health', (req, res) => res.status(200).json({ ok: true, service: 'gomath-report', time: Date.now() }));

app.post('/generate', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.dateStr) payload.dateStr = kstMonthDay();

    const { system, user } = buildPrompt(payload);
    const prompt = `${system}\n\n${user}`;

    const text = await fetchGeminiReport(prompt);
    return res.json({ report: text });
  } catch (err) {
    const msg = err?.message || String(err);
    return res.status(500).json({ report: `⚠️ 서버 내부 오류: ${msg}` });
  }
});

/* ===== 시작 ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 서버 실행: http://localhost:${PORT}`);
});
