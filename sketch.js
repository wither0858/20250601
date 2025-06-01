let video; // 攝影機物件
let handpose; // ml5 手部辨識模型
let predictions = []; // 存放手部預測結果

let pointerX = 0; // 指針X座標
let pointerY = 0; // 指針Y座標
const smoothWindow = 5; // 平滑移動的歷史紀錄數
let posHistoryX = []; // X座標歷史紀錄
let posHistoryY = []; // Y座標歷史紀錄

// 將 wordList 修改為物件陣列，包含中文提示和英文單字
let wordList = [
  { chinese: "蘋果", english: "APPLE" },
  { chinese: "狗", english: "DOG" },
  { chinese: "房子", english: "HOUSE" },
  { chinese: "月亮", english: "MOON" },
  { chinese: "貓", english: "CAT" },
  { chinese: "樹", english: "TREE" },
  { chinese: "鳥", english: "BIRD" },
  { chinese: "星星", english: "STAR" },
  { chinese: "水", english: "WATER" },
  { chinese: "火", english: "FIRE" }
];

let wordsToSpell = []; // 本輪遊戲要拼的單字列表
let currentWordIndex = 0; // 當前拼到第幾個單字

let currentChinesePrompt = ""; // 當前要顯示的中文提示
let currentEnglishWord = "";    // 當前要拼的英文單字

let currentLetterIndex = 0; // 當前拼到第幾個字母
let buttons = []; // 按鈕陣列

const hoverThreshold = 500; // 停留多久算點擊 (毫秒)
const speedThreshold = 0.5; // 手指移動速度的閾值，低於此值才考慮為停留

let hoverStartTime = 0; // 懸停開始時間
let hoveredButton = null; // 當前懸停的按鈕
let buttonSoundPlayed = false; // 追蹤當前懸停的按鈕是否已經播放過音效

let lastCheckTime = 0; // 上次檢查時間
let lastPosX = 0; // 上次X位置
let lastPosY = 0; // 上次Y位置

let score = 0; // 分數
let wrongFlashTime = 0; // 錯誤閃爍開始時間
let wrongButton = null; // 錯誤的按鈕

// 遊戲狀態變數
let gameState = 'playing'; // 'playing' 或 'gameOver'

// 宣告音效變數
let correctSound; // 答對音效
let wrongSound; // 答錯音效
let buttonHoverSound; // 懸停音效
let bgm; // 新增背景音樂變數

function preload() {
  // 在這裡加載音效檔案
  // 確保這些檔案在你的專案資料夾中
  correctSound = loadSound('131660__bertrof__game-sound-correct.wav');
  wrongSound = loadSound('131657__bertrof__game-sound-wrong.wav');
  buttonHoverSound = loadSound('237422__plasterbrain__hover-1.ogg');
  bgm = loadSound('Escoffier Theme Music EXTENDED - A Gastronomic Symphony (tnbee mix)  Genshin Impact.mp3'); // 載入背景音樂
}

function setup() {
  createCanvas(windowWidth, windowHeight); // 建立畫布
  video = createCapture(VIDEO); // 啟用攝影機
  video.size(640, 480); // 設定攝影機解析度
  video.hide(); // 隱藏原始視訊元素，我們會在畫布上繪製它

  // 載入手部姿勢辨識模型
  handpose = ml5.handpose(video, () => {
    console.log("模型已載入");
  });
  // 當模型預測到結果時，更新 predictions 陣列
  handpose.on("predict", results => {
    predictions = results;
  });

  textFont('Helvetica Neue, Arial, sans-serif');
  resetGame(); // 遊戲開始時呼叫一次 resetGame

  if (bgm) {
    bgm.setVolume(0.5); // 音量可自行調整
    bgm.loop();         // 循環播放
  }
}

let consecutiveCorrect = 0; // 連續答對題數

function resetGame() {
  consecutiveCorrect = 0; // 先歸零，避免setNextWord判斷錯誤
  // 複製一份單字列表並打亂，用於本輪遊戲
  wordsToSpell = shuffle(wordList.slice(), true);
  currentWordIndex = 0;
  score = 0;
  gameState = 'playing'; // 設定遊戲狀態為進行中

  // 設定第一個單字
  setNextWord();

  // 重置其他遊戲狀態變數
  currentLetterIndex = 0;
  posHistoryX = [];
  posHistoryY = [];
  hoveredButton = null;
  hoverStartTime = 0;
  buttonSoundPlayed = false; // 重置音效播放標記
  wrongFlashTime = 0;
  wrongButton = null;
}

// 設置下一個要拼的單字
function setNextWord() {
  if (consecutiveCorrect >= 5) {
    gameState = 'gameOver';
    return;
  }
  if (currentWordIndex < wordsToSpell.length) {
    currentChinesePrompt = wordsToSpell[currentWordIndex].chinese;
    currentEnglishWord = wordsToSpell[currentWordIndex].english;
    currentLetterIndex = 0; // 重置字母索引
    generateButtons(); // 重新生成按鈕
  } else {
    // 所有單字都拼完了，遊戲結束
    gameState = 'gameOver';
  }
}

function generateButtons() {
  buttons = [];
  let letters = currentEnglishWord.split(""); // 從當前英文單字中獲取字母

  // 增加按鈕數量提升挑戰度，確保有 12 個按鈕
  while (letters.length < 12) {
    let randChar = String.fromCharCode(65 + int(random(26))); // 隨機生成一個大寫字母
    if (!letters.includes(randChar)) letters.push(randChar); // 如果字母不在裡面，就加入
  }
  shuffle(letters, true); // 將字母陣列打亂

  let margin = 80; // 左右邊距
  let btnSize = 80; // 按鈕大小
  // 計算按鈕間距，讓按鈕均勻分佈
  let spacing = (width - margin * 2) / (letters.length - 1);

  for (let i = 0; i < letters.length; i++) {
    let x = margin + i * spacing;
    let y = height - 150; // 按鈕Y軸位置
    buttons.push({
      label: letters[i], // 按鈕上的字母
      x: x,
      y: y,
      size: btnSize,
      scale: 1 // 初始縮放比例
    });
  }
}

function draw() {
  // 設定背景漸層
  setBackgroundGradient();

  if (gameState === 'playing') {
    // 遊戲進行中
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, (video.height / video.width) * width);
    pop();

    drawButtons();
    drawTargetWord();
    drawScore();
    trackFinger(width, (video.height / video.width) * width);
    drawPointer();
    drawWrongFlash();
  } else if (gameState === 'gameOver') {
    // 遊戲結束畫面
    drawGameOverScreen();
  }

  
}

function setBackgroundGradient() {
  let c1 = color(210, 240, 255); // 淺藍色
  let c2 = color(180, 210, 240); // 深藍色
  noFill(); // 不填充
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1); // 從上到下映射漸層值
    stroke(lerpColor(c1, c2, inter)); // 根據漸層值混合顏色
    line(0, y, width, y); // 繪製水平線
  }
}

// 美化按鈕
function drawButtons() {
  for (let btn of buttons) {
    btn.scale = (hoveredButton === btn) ? lerp(btn.scale, 1.18, 0.2) : lerp(btn.scale, 1, 0.1);

    // 播放懸停音效
    if (hoveredButton === btn && !buttonSoundPlayed) {
      if (buttonHoverSound && !buttonHoverSound.isPlaying()) buttonHoverSound.play();
      buttonSoundPlayed = true;
    } else if (hoveredButton !== btn) {
      buttonSoundPlayed = false;
    }

    push();
    translate(btn.x, btn.y);
    scale(btn.scale);

    // 按鈕漸層
    let grad = drawingContext.createLinearGradient(-btn.size/2, 0, btn.size/2, btn.size);
    grad.addColorStop(0, hoveredButton === btn ? "#b2f7ef" : "#fff");
    grad.addColorStop(1, hoveredButton === btn ? "#7de2d1" : "#e0e0e0");
    drawingContext.fillStyle = grad;

    // 陰影
    drawingContext.shadowColor = 'rgba(0,0,0,0.18)';
    drawingContext.shadowBlur = 12;
    drawingContext.shadowOffsetX = 2;
    drawingContext.shadowOffsetY = 4;

    noStroke();
    rectMode(CENTER);
    rect(0, 0, btn.size, btn.size, 26);

    drawingContext.shadowBlur = 0;

    // 字母外框
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(46);
    strokeWeight(6);
    stroke(hoveredButton === btn ? "#fff" : "#222"); // 外框顏色
    fill(hoveredButton === btn ? "#1e5631" : "#222"); // 字母顏色
    text(btn.label, 0, 2);

    // 再畫一次字母（填色），讓外框更明顯
    noStroke();
    fill(hoveredButton === btn ? "#3ad29f" : "#fff");
    text(btn.label, 0, 2);

    pop();
  }
}

// 美化目標單字區塊
function drawTargetWord() {
  // 背景區塊
  push();
  rectMode(CENTER);
  noStroke();
  fill(255, 255, 255, 220);
  drawingContext.shadowColor = 'rgba(0,0,0,0.10)';
  drawingContext.shadowBlur = 18;
  rect(width/2, 120, 480, 120, 36);
  drawingContext.shadowBlur = 0;
  pop();

  fill(50, 80, 50);
  textSize(38);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  text(`拼出這個字:`, width / 2, 70);

  fill(0, 120, 20);
  textSize(54);
  textStyle(BOLD);
  text(currentChinesePrompt, width / 2, 120);

  fill(0, 150, 50);
  textSize(32);
  textStyle(NORMAL);
  text(`已輸入: ${currentEnglishWord.substring(0, currentLetterIndex)}`, width / 2, 170);
}

function drawScore() {
  fill(20, 100, 20); // 深綠色
  textSize(32); // 文字大小
  textAlign(RIGHT, TOP); // 右上角對齊
  text(`分數: ${score}`, width - 40, 40); // 顯示分數
}

function trackFinger(videoDrawWidth, videoDrawHeight) {
  if (predictions.length > 0) {
    let hand = predictions[0]; // 取得第一個手部偵測結果
    let indexTip = hand.annotations.indexFinger[3]; // 取得食指指尖的座標

    let rawX = indexTip[0]; // 原始X座標
    let rawY = indexTip[1]; // 原始Y座標

    // 將原始座標縮放到畫布大小
    let scaledX = (rawX / video.width) * videoDrawWidth;
    let scaledY = (rawY / video.height) * videoDrawHeight;

    // 因為攝影機畫面是翻轉的，所以X座標需要再次翻轉
    let targetX = width - scaledX;
    let targetY = scaledY;

    // 將當前位置加入歷史紀錄
    posHistoryX.push(targetX);
    posHistoryY.push(targetY);
    // 如果歷史紀錄超過平滑窗口大小，則移除最舊的紀錄
    if (posHistoryX.length > smoothWindow) posHistoryX.shift();
    if (posHistoryY.length > smoothWindow) posHistoryY.shift();

    // 計算平均位置來平滑指針移動
    pointerX = posHistoryX.reduce((a, b) => a + b, 0) / posHistoryX.length;
    pointerY = posHistoryY.reduce((a, b) => a + b, 0) / posHistoryY.length;

    fill(255, 0, 0); // 紅色
    noStroke(); // 不繪製邊框
    ellipse(pointerX, pointerY, 28); // 繪製指尖圓點

    let now = millis(); // 當前時間
    let deltaTime = now - lastCheckTime; // 時間間隔
    // 計算指尖移動距離
    let distMoved = dist(pointerX, pointerY, lastPosX, lastPosY);
    // 計算速度 (距離 / 時間間隔)
    let speed = deltaTime > 0 ? distMoved / deltaTime : 0;

    lastCheckTime = now; // 更新上次檢查時間
    lastPosX = pointerX; // 更新上次X位置
    lastPosY = pointerY; // 更新上次Y位置

    checkHover(pointerX, pointerY, speed); // 檢查是否有按鈕被懸停
  } else {
    // 如果沒有手部偵測結果，重置懸停狀態和位置歷史紀錄
    hoveredButton = null;
    hoverStartTime = 0;
    buttonSoundPlayed = false; // 如果沒有手部偵測，重置音效播放標記
    posHistoryX = [];
    posHistoryY = [];
  }
}

function checkHover(x, y, speed) {
  let hovering = false; // 是否有任何按鈕正在被懸停
  let newHoveredButton = null; // 暫存新懸停的按鈕

  for (let btn of buttons) {
    let d = dist(x, y, btn.x, btn.y); // 計算指針到按鈕中心的距離
    if (d < btn.size / 2) { // 如果指針在按鈕範圍內
      if (speed < speedThreshold) { // 如果手指移動速度夠慢 (表示停留)
        newHoveredButton = btn; // 找到懸停的按鈕
        if (hoveredButton !== btn) { // 如果是剛懸停到這個按鈕
          hoveredButton = btn; // 設定為當前懸停的按鈕
          hoverStartTime = millis(); // 記錄懸停開始時間
          buttonSoundPlayed = false; // 這是新懸停的按鈕，重置音效播放標記
        } else {
          // 如果已經懸停在這個按鈕一段時間，且超過閾值
          if (millis() - hoverStartTime > hoverThreshold) {
            selectLetter(btn); // 執行選擇字母的動作
            hoveredButton = null; // 重置懸停按鈕
            hoverStartTime = 0; // 重置懸停開始時間
            buttonSoundPlayed = false; // 選擇後重置音效播放標記
            return; // 選擇後就結束檢查，避免重複觸發
          }
        }
        hovering = true; // 標記為正在懸停
        break; // 找到一個按鈕後就跳出迴圈
      } else {
        // 如果速度太快，取消懸停狀態
        hoveredButton = null;
        hoverStartTime = 0;
        buttonSoundPlayed = false; // 速度太快，重置音效播放標記
      }
    }
  }

  // 如果離開了所有按鈕，重置懸停狀態
  if (!hovering && hoveredButton !== null) { // 確保不是從未懸停到未懸停的狀態
    hoveredButton = null;
    hoverStartTime = 0;
    buttonSoundPlayed = false; // 離開按鈕時重置音效播放標記
  }
}

// 拼錯直接換題，連續答對歸零
function selectLetter(btn) {
  if (btn.label === currentEnglishWord[currentLetterIndex]) {
    currentLetterIndex++;
    score += 10;
    if (correctSound) correctSound.play();

    if (currentLetterIndex >= currentEnglishWord.length) {
      score += 50;
      currentWordIndex++;
      consecutiveCorrect++;
      if (consecutiveCorrect >= 5) {
        gameState = 'gameOver';
        return;
      }
      setNextWord();
    }
  } else {
    if (wrongSound) wrongSound.play();
    consecutiveCorrect = 0; // 答錯歸零
    currentWordIndex++;     // 直接換下一題
    setNextWord();
  }
}

// 只有連續對五題才會結束，否則題目用完就重抽
function setNextWord() {
  if (consecutiveCorrect >= 5) {
    gameState = 'gameOver';
    return;
  }
  if (currentWordIndex < wordsToSpell.length) {
    currentChinesePrompt = wordsToSpell[currentWordIndex].chinese;
    currentEnglishWord = wordsToSpell[currentWordIndex].english;
    currentLetterIndex = 0;
    generateButtons();
  } else {
    // 題目用完但未連續對五題，重抽題目
    wordsToSpell = shuffle(wordList.slice(), true);
    currentWordIndex = 0;
    setNextWord();
  }
}

function drawTargetWord() {
  // 背景區塊
  push();
  rectMode(CENTER);
  noStroke();
  fill(255, 255, 255, 220);
  drawingContext.shadowColor = 'rgba(0,0,0,0.10)';
  drawingContext.shadowBlur = 18;
  rect(width/2, 120, 480, 120, 36);
  drawingContext.shadowBlur = 0;
  pop();

  fill(50, 80, 50);
  textSize(38);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  text(`拼出這個字:`, width / 2, 70);

  fill(0, 120, 20);
  textSize(54);
  textStyle(BOLD);
  text(currentChinesePrompt, width / 2, 120);

  fill(0, 150, 50);
  textSize(32);
  textStyle(NORMAL);
  text(`已輸入: ${currentEnglishWord.substring(0, currentLetterIndex)}`, width / 2, 170);
}

function drawPointer() {
  noFill(); // 不填充
  stroke(255, 0, 0, 150); // 紅色半透明邊框
  strokeWeight(3); // 邊框粗細
  ellipse(pointerX, pointerY, 40); // 繪製外圈圓點
}

function drawWrongFlash() {
  // 如果有錯誤按鈕，且閃爍時間未超過 400 毫秒
  if (wrongButton && millis() - wrongFlashTime < 400) {
    push();
    translate(wrongButton.x, wrongButton.y); // 將原點移到錯誤按鈕中心
    noFill(); // 不填充
    stroke(255, 0, 0); // 紅色邊框
    strokeWeight(8); // 更粗的邊框
    ellipse(0, 0, wrongButton.size + 10); // 繪製一個比按鈕稍大的圓
    pop();
  } else {
    wrongButton = null; // 重置錯誤按鈕
  }
}

// 繪製遊戲結束畫面
function drawGameOverScreen() {
  // --- 背景漸層 ---
  let c1 = color(80, 180, 220, 220);
  let c2 = color(30, 60, 120, 220);
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    stroke(lerpColor(c1, c2, inter));
    line(0, y, width, y);
  }

  // --- 中央光暈圓 ---
  noStroke();
  for (let r = 400; r > 0; r -= 10) {
    fill(255, 255, 200, map(r, 400, 0, 0, 120));
    ellipse(width / 2, height / 2 - 60, r * 2);
  }

  // --- 恭喜icon ---
  textAlign(CENTER, CENTER);
  textSize(100);
  text("🎉", width / 2, height / 2 - 220);

  // --- 遊戲結束標題 ---
  fill(255, 255, 120);
  textSize(64);
  drawingContext.shadowColor = 'rgba(0,0,0,0.7)';
  drawingContext.shadowBlur = 18;
  text("遊戲結束！", width / 2, height / 2 - 120);
  drawingContext.shadowBlur = 0;

  // --- 恭喜說明 ---
  stroke(0, 120, 80);
  strokeWeight(6);
  fill(255, 255, 255, 240);
  textSize(44);
  textStyle(BOLD);
  text("你連續答對五題！", width / 2, height / 2 - 60);
  noStroke();

  // --- 分數板 ---
  let scoreBoardW = 420;
  let scoreBoardH = 170;
  let scoreBoardX = width / 2;
  let scoreBoardY = height / 2 + 30;

  // 半透明漸層分數板
  for (let i = 0; i < 30; i++) {
    fill(255, 255, 255, 30 - i);
    rectMode(CENTER);
    rect(scoreBoardX, scoreBoardY, scoreBoardW - i * 2, scoreBoardH - i * 2, 40);
  }
  stroke(255, 255, 255, 120);
  strokeWeight(3);
  noFill();
  rect(scoreBoardX, scoreBoardY, scoreBoardW, scoreBoardH, 40);

  // --- 分數文字動畫 ---
  fill(0, 180, 90);
  noStroke();
  textSize(38);
  text("最終分數", scoreBoardX, scoreBoardY - 35);

  // 分數跳動動畫
  let displayScore = score;
  let t = millis() % 1000;
  let scaleAnim = 1 + 0.08 * sin(TWO_PI * t / 1000);
  push();
  translate(scoreBoardX, scoreBoardY + 30);
  scale(scaleAnim);
  fill(0, 255, 120);
  textSize(80);
  text(displayScore, 0, 0);
  pop();

  // --- 重新開始按鈕 ---
  let restartButtonX = width / 2;
  let restartButtonY = height / 2 + 170;
  let restartButtonW = 280;
  let restartButtonH = 90;

  let restartBtnColor = color(50, 150, 50);
  let restartBtnHoverColor = color(70, 170, 70);

  let currentBtnColor = restartBtnColor;
  let btnScale = 1;

  if (mouseX > restartButtonX - restartButtonW / 2 &&
      mouseX < restartButtonX + restartButtonW / 2 &&
      mouseY > restartButtonY - restartButtonH / 2 &&
      mouseY < restartButtonY + restartButtonH / 2) {
    currentBtnColor = restartBtnHoverColor;
    btnScale = lerp(1, 1.07, 0.2);
    cursor(HAND);
  } else {
    btnScale = lerp(btnScale, 1, 0.1);
    cursor(ARROW);
  }

  push();
  translate(restartButtonX, restartButtonY);
  scale(btnScale);

  fill(currentBtnColor);
  noStroke();
  rectMode(CENTER);
  rect(0, 0, restartButtonW, restartButtonH, 22);

  drawingContext.shadowColor = 'rgba(0,0,0,0.5)';
  drawingContext.shadowBlur = 6;
  drawingContext.shadowOffsetX = 2;
  drawingContext.shadowOffsetY = 2;

  fill(255);
  textSize(38);
  textAlign(CENTER, CENTER);
  text("重新開始", 0, 0);

  drawingContext.shadowBlur = 0;
  pop();
}

// 處理滑鼠點擊，用於重新開始按鈕 (因為遊戲結束時手部偵測停止，所以用滑鼠點擊)
function mousePressed() {
  if (gameState === 'gameOver') {
    let restartButtonX = width / 2;
    let restartButtonY = height / 2 + 170;
    let restartButtonW = 280;
    let restartButtonH = 90;

    // 檢查滑鼠點擊是否在重新開始按鈕上
    if (mouseX > restartButtonX - restartButtonW / 2 &&
        mouseX < restartButtonX + restartButtonW / 2 &&
        mouseY > restartButtonY - restartButtonH / 2 &&
        mouseY < restartButtonY + restartButtonH / 2) {
      resetGame(); // 重新開始遊戲
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 只有在遊戲進行中才重新生成按鈕，當前畫面如果是遊戲結束畫面，按鈕位置會隨中心調整
  if (gameState === 'playing') {
     generateButtons();
  }
  // 遊戲結束畫面不需要重新生成按鈕，元素會自動居中
}