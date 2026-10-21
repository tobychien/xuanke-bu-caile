// 社群評價整理：由使用者提供的 Dcard 截圖彙整，全部改寫成「客觀描述」（不放原文、不放帳號）
// 撰寫原則：只寫課程怎麼進行、成績由哪些項目組成、作業與考試量、公開可查的分數；
//   不寫對老師個人的褒貶、情緒用語、傳聞，也不寫「學不到東西」「很爛」這類主觀判斷。
// code：課程代碼（通識用 GE-LE 人文藝術／GE-GS 社會科學／GE-GN 自然科學／GE-LS 生命科學；領域不明用 GE-ALL）
// title：通識的實際課名；teacher 空白代表貼文沒寫老師
// homework／grading：1–5（5=作業多／給分偏高），是依貼文描述的成績與評分項目換算（derived），不是原作者打的分數
const src = 'Dcard 社群整理';
const when = '約 2023 年的貼文';
window.REVIEWS = [
  { code: 'GE-LE', title: '輕鬆優雅學易經', teacher: '陳巍仁', source: src, when, score: '有人成績 99（最高 100）', summary: '每次出席簽到，另有一次隨堂測驗、期中報告與期末報告。舉手發言可加分。', points: ['每次簽到', '期中期末報告', '舉手加分'], homework: 3, grading: 5, derived: true },
  { code: 'GE-ALL', title: '性別與社會', teacher: '糠明珊', source: src, when, score: '有人成績 99（最高 99）', summary: '老師親自點名，常有簡單的隨堂測驗，另有 1000 字閱讀心得和期末報告。課堂規則包含遲到、睡覺、講話、使用手機會扣分。', points: ['親自點名', '常有隨堂測驗', '閱讀心得 1000 字', '課堂規則明確'], homework: 3, grading: 5, derived: true },
  { code: 'GE-LE', title: '日本文化概論', teacher: '糠明珊', source: src, when, score: '有人成績 99（最高 99）', summary: '點名、兩次小考、1000 字閱讀心得，加上期中與期末考。小考和考試內容細，需要做筆記；另有留言提到須記憶不少節慶日期。', points: ['點名', '兩次小考', '期中期末考', '需記日期', '需做筆記'], homework: 4, grading: 4, derived: true },
  { code: 'GE-ALL', title: '綠色能源講座', teacher: '林秀麗', source: src, when, score: '有人成績 97（最高 100）', summary: '需舉手發問（有基本次數），每次上課寫一張學習單，另有期中與期末心得報告。學習單與報告依內容完整度評分。', points: ['每次學習單', '舉手發問', '期中期末心得'], homework: 4, grading: 5, derived: true },
  { code: 'GE-LE', title: '俄羅斯思想與文化', teacher: '胡逢瑛', source: src, when, score: '有人成績 96（最高 99）', summary: '每次簽到、學習單、課堂需朗讀俄語，另有 2000 字閱讀心得和期末考。每週課堂結束前會說明一兩題期末考題目。', points: ['每次簽到', '學習單', '心得 2000 字', '期末考'], homework: 5, grading: 4, derived: true },
  { code: 'GE-ALL', title: '微生物的世界', teacher: '陳奇良', source: src, when, score: '有人成績 100（最高 100）', summary: '偶爾有課堂小考，期末考為單選加多選。每週出席、被抽到舉手回答可加分；期末前幾週會講解部分考題。', points: ['偶爾小考', '期末單選多選', '會講解考題', '出席加分'], homework: 1, grading: 5, derived: true },
  { code: 'GE-ALL', title: '病媒與生活', teacher: '陳奇良', source: src, when, score: '有人成績 98（最高 100）', summary: '進行方式與同一位老師的微生物課類似：偶爾小考、期末單選加多選，期末前會講解考題，出席和舉手回答可加分。', points: ['偶爾小考', '期末單選多選', '會講解考題'], homework: 1, grading: 5, derived: true },
  { code: 'GE-ALL', title: '兩性與情愛', teacher: '王怡云', source: src, when, score: '有人成績 94（最高 96）', summary: '1500 到 2000 字的閱讀心得、小組討論活動、期末小組拍攝短片，以及期末小組互評。組員由老師分配，需分工。有同學表示多數人的成績落在 85 到 90 分。', points: ['閱讀心得 2000 字', '小組拍短片', '小組互評', '分數 85–90 居多'], homework: 5, grading: 3, derived: true },
  { code: 'GE-ALL', title: '人體奧秘與保健', teacher: '熊正輝', source: src, when, score: '有人成績 90（最高 95）', summary: '以類似隨堂測驗的方式進行（一次五題），另有期末報告。', points: ['隨堂測驗', '期末報告'], homework: 2, grading: 3, derived: true },
  { code: 'GE-GS', title: '性別教育', teacher: '鍾秋玉', source: src, when, score: '有人成績 87（最高 97）', summary: '偶爾需繳交隨堂作業，期末有考試。貼文中提到不少人考試分數高，學期成績也偏高。', points: ['偶爾繳隨堂作業', '期末考'], homework: 1, grading: 3, derived: true },
  { code: 'GE-ALL', title: '通識講座', teacher: '王怡云', source: src, when, score: '有人成績 87（最高 93）', summary: '需撰寫講座學習單、進行小組討論、繳交校外參訪心得，另有期中考、期末海報和期末互評。組員由老師分配。有同學表示多數人的成績落在 85 到 90 分。', points: ['講座學習單', '小組海報', '校外參訪', '分數 85–90 居多'], homework: 4, grading: 3, derived: true },
  { code: 'GE-LS', title: '中醫概論與中醫保健', teacher: '陳曉鈞', source: src, when, score: '有人成績 85（最高 88）', summary: '出席點名，加上期中和期末報告。', points: ['點名', '期中期末報告'], homework: 3, grading: 2, derived: true },
  { code: 'GE-LS', title: '疾病概論', teacher: '蕭聖謀', source: src, when, score: '有人成績 83（最高 97）', summary: '成績由期中考和期末考決定，同學之間分數差異大（最高 97）。', points: ['期中期末考', '分數差異大'], homework: 2, grading: 2, derived: true },
  { code: 'GE-GS', title: '科技發展與社會變遷', teacher: '', source: src, when, score: '有人成績 99（2 學分）', summary: '貼文僅提到上課時間為早上第一節，沒有寫老師與評分方式，只能代表當時開課的班級。', points: ['早上第一節'], homework: null, grading: 5, derived: true },

  // ---- 管院必修課（第二批截圖）----
  { code: 'CM003', title: '程式設計（2021 年成績公布後的討論）', teacher: '陳正和', source: src, when: '2021 年的貼文', score: '', summary: '學期成績公布後的討論串：有同學提到成績落點偏低、80 到 90 分較少；也有同學提到小考占分重，認真上課且小考表現好者成績較高。同學對評分規則的理解不一致，是單篇舊學期的討論。', points: ['小考占分重', '同學看法不一'], homework: null, grading: 2, derived: true, note: '單篇、舊學期的討論，只當參考' },
  { code: 'CM103', title: '會計學（整體心得）', teacher: '', source: src, when: '2020 年的貼文', score: '', summary: '初級會計是之後中級、高級會計的基礎。往上修讀的課程內容較複雜，需要的準備時間也較長，期中期末前常需要較多的複習時間。', points: ['初會是基礎', '後續課程較複雜', '期中期末需要較多複習'], homework: 3, grading: null, derived: true },
  { code: 'CM103', title: '中級會計學（105 上）', teacher: '鄭佳綺', source: src, when: '2017 年的課程心得', score: '', summary: '成績由上課 10%、小考 25%、期中 30%、期末 35% 組成。小考的選擇題為觀念題，計算題多取自老師勾選的題目；期中期末的計算題難度不一，加分題可使總分超過 100。心得提到上課有跟上、練習老師勾選的題目即可應付多數考題。', points: ['小考占 25%', '加分題可超過 100', '練習勾選題'], homework: 3, grading: 4, derived: true, other: true, note: '這是老師以前開的中級會計，和這學期的課不同' },
  { code: 'CM103', title: '會計課（2020 年的留言）', teacher: '鄭佳綺', source: src, when: '2020 年的貼文', score: '', summary: '有同學留言提到老師的會計課成績普遍不錯，但需要投入不少時間準備，期中期末前複習的時間較長。', points: ['成績普遍不錯', '需投入時間'], homework: 4, grading: 4, derived: true, other: true, note: '留言談的是老師的中級會計，不是這學期的會計學（上）' },
  { code: 'CM103', title: '會計學（2025 年初）', teacher: '呂倩如', source: src, when: '2025 年的貼文', score: '有人學期成績 95', summary: '有同學期中考約 30 到 40 分、期末考 96，學期成績 95。多則留言提到小考占分有重要影響，認真準備小考能拿到高分；也有留言提醒要固定出席、小考不要太低、上課避免使用手機。', points: ['小考影響大', '需固定出席', '期末分數可拉高總成績'], homework: 3, grading: 4, derived: true },
  { code: 'CM103', title: '管院基礎程式設計（2025 年）', teacher: '粘凱婷', source: src, when: '2025 年的貼文', score: '', summary: '詢問老師程式設計課的貼文。留言提到課程難度屬中等偏易，有不懂的地方可以直接向老師發問。', points: ['難度中等偏易', '可直接發問'], homework: null, grading: 4, derived: true, other: true, note: '這則談的是老師的程式設計課，不是這學期的會計學' },

  // ---- 經濟學、管理學（第三批截圖）----
  { code: 'CM105', title: '經濟學（下）', teacher: '曾翊恆', source: src, when: '2024 年的貼文', score: '', summary: '課本有原文書，但老師以中文簡報上課，班上有人買原文書、也有人用中譯本。有同學表示期中考範圍以簡報和平常作業為主；需自行找組員分組，期中考後開始做報告。', points: ['中文簡報上課', '期中考範圍＝簡報＋作業', '需分組'], homework: 2, grading: 4, derived: true },
  { code: 'CM105', title: '國際金融（2020，另一門課）', teacher: '曾翊恆', source: src, when: '2020 年的貼文', score: '有人學期成績 92', summary: '作業為每週預測匯率與股價指數，期末需上台報告預測方式。上課進度快，講義題目會分給每組、下次上台解題；有兩次小考，期中期末含選擇、計算填空與問答，題庫份量大。有同學建議核對老師提供的舊解答，有疑問可先請教助教。', points: ['需分組', '兩次小考', '上課進度快', '題庫份量大'], homework: 4, grading: 4, derived: true, other: true, note: '這是老師開的國際金融（高年級選修），不是這學期的經濟學' },
  { code: 'CM105', title: '大一經濟學（2020）', teacher: '吳菊華', source: src, when: '2020 年的貼文', score: '有人學期 88～95', summary: '詢問課本和 PPT 的貼文。多則留言表示老師以 PPT 上課，課本不一定要購買；有人以 PPT 加自己整理的筆記與練習題準備，學期成績約 90 到 95。', points: ['PPT 上課', '課本可不買', '學期 88–95'], homework: 2, grading: 4, derived: true },
  { code: 'CM108', title: '管理學（2022）', teacher: '陳懷傑', source: src, when: '2022 年的貼文', score: '', summary: '當時為新任老師。有同學說上課內容多、邊講邊提問，需自行做筆記並每週複習；作業幾乎每週都有。期中為企業參訪心得與採訪管理者，加筆試；期末為專案報告加筆試（英文出題，附中文翻譯，選項不附）。專案可能不定時繳交進度報告。課堂規定包含準時進教室、離開教室前先告知老師。', points: ['作業每週有', '採訪管理者', '專案報告', '筆試英文出題', '需自行做筆記'], homework: 5, grading: 3, derived: true, note: '2022 年的描述；這學期官方成績配分（作業 30%、平時 40%、期末 30%）可能已調整' },

  // ---- 更多老師（第四批截圖）----
  { code: 'CM108', title: '全球產業分析（2019，另一門課）', teacher: '吳相勳', source: src, when: '2019 年的貼文', score: '有人學期成績 96', summary: '全英文授課。期中為申論題，內容取自課堂講過的範圍；各組需準備新聞相關的主題報告。上課會介紹近期國際商業事件並以實例說明。', points: ['全英文', '申論題', '新聞主題報告'], homework: 3, grading: 5, derived: true, other: true, note: '這是老師開的全球產業分析（不是管理學）；部分留言來自平台標示為「身份確認中」的帳號，可信度較低' },
  { code: 'CM114', title: '人才培育與才能管理（2019，另一門課）', teacher: '黃瓊億', source: src, when: '2019 年的貼文', score: '', summary: '修過的同學描述：開學先分組找企業，分析其員工所需的訓練課程，再依理論規劃，整學期完成一份人才培育企劃書。共有六次進度報告加一次期末報告，作業量大。', points: ['分組找企業', '六次進度報告', '期末企劃書'], homework: 5, grading: null, derived: true, other: true, note: '這是老師開的人才培育與才能管理（選修），不是企業倫理' },
  { code: 'CM116', title: '投資組合與證券分析（2022，另一門課）', teacher: '吳志強', source: src, when: '2022 年的貼文', score: '', summary: '留言提到成績主要依考試和報告計算，投入準備者成績多落在 90 分上下，準備不足則可能不及格。', points: ['考試加報告', '成績依準備程度而異'], homework: 3, grading: 4, derived: true, other: true, note: '這是老師開的投資組合與證券分析（高年級選修），不是微積分' },
  { code: 'CM116', title: '微積分（2024 年 9 月）', teacher: '姜一銘', source: src, when: '2024 年的貼文', score: '', summary: '上課進度快，每次大約 20 到 30 頁，依課本單元進行，老師講解原理，其餘需自行練習。建議練習老師在課本上勾選的習題；上課抄筆記有基本分，可能會傳點名單。', points: ['每次 20–30 頁', '練勾選習題', '抄筆記有基本分', '可能點名'], homework: 3, grading: 3, derived: true },
  { code: 'CM116', title: '微積分（實習課建議）', teacher: '姜一銘', source: src, when: '2024 年的貼文', score: '', summary: '有同學建議參加實習課，表示助教會在實習課補充說明正課內容（不確定目前助教是否仍在）。', points: ['建議上實習課', '助教補充說明'], homework: null, grading: null, derived: true },

  // ---- 英語（一）（第五批截圖）----
  { code: 'LC101', title: '進階英語（2025 年 8 月）', teacher: '斯婁福', source: src, when: '2025 年的貼文（最近）', score: '有人說班上最高分約 92 到 96', summary: '多則留言提到作業量大，班上最高分約 94 到 96。加分方式包含上課回答問題、參加英文比賽或英檢（培力英檢會加總分，但公告最多 95）。留言提到考試難度視英文程度而異，學測英文高分者表示考前準備單字即可。需攜帶筆記，作弊或抄作業會被處理。多益未達門檻則不能換班。', points: ['作業量大', '回答問題加分', '英文比賽與英檢加分', '須攜帶筆記'], homework: 5, grading: 2, derived: true, note: '各人感受不一；以官方課程大綱與公告為準' },
  { code: 'LC101', title: '進階英語（2023 年 12 月）', teacher: '斯婁福', source: src, when: '2023 年的貼文', score: '有人說上下學期最高分約 90 上下', summary: '留言描述課程包含：上課不使用手機、每週作業、多益模擬測驗、寒假作業，並重視出席，缺席需有正當理由。有人提到最高分約 90。不同留言對課程負擔的描述不同，可能來自不同學期。', points: ['每週作業', '多益模擬測驗', '寒假作業', '重視出席'], homework: 5, grading: 3, derived: true, note: '同一串留言對課程負擔的描述不同，可能是不同學期；只當參考' },
  { code: 'LC101', title: '英語課（2020、2023）', teacher: '安琪拉', source: src, when: '2020 年與 2023 年的留言', score: '', summary: '2023 年有同學修了兩學期，描述成績主要來自小考、問答和上台發表，按時到課並回答問題者成績不低。大一英文每堂點名，缺席遲到會扣分；口說英文需拍攝影片（一學期兩次）。', points: ['小考問答上台', '每堂點名', '口說影片兩次'], homework: 3, grading: 4, derived: true, note: '2020 年的留言談的是老師的觀光英文、媒體新聞英文、口說英文，2023 年是進階英語，不一定等於這學期' }
];
