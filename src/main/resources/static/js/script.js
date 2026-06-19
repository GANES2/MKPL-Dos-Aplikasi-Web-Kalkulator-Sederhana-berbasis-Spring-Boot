const video = document.getElementById('webcam');
const monkeyCanvas = document.getElementById('monkey-preview');
const monkeyCtx = monkeyCanvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');
const timerOverlay = document.getElementById('timer-overlay');
const flashOverlay = document.getElementById('flash-overlay');

const captureCanvas = document.getElementById('capture-canvas');
const captureCtx = captureCanvas.getContext('2d');

const finalCanvas = document.getElementById('final-canvas');
const finalCtx = finalCanvas.getContext('2d');

const boothContainer = document.getElementById('booth-container');
const resultSection = document.getElementById('result-section');
const controls = document.querySelector('.controls');

let monkeyImg = new Image();
monkeyImg.src = 'images/monkey_strip.jpg';

// 4 photos will be taken
const totalPhotos = 4;
let currentPhotoIndex = 0;
let userPhotos = [];

// Audio Context for beep
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(frequency, duration) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

// Start Webcam
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        statusText.innerText = "Gagal mengakses kamera. Pastikan memberikan izin!";
        startBtn.disabled = true;
    });

// Wait for image to load to draw the first monkey pose
monkeyImg.onload = () => {
    drawMonkeyPose(0);
};

// Draw a specific monkey pose on the reference canvas
function drawMonkeyPose(index) {
    if (!monkeyImg.complete || monkeyImg.naturalHeight === 0) return;
    
    // Gambar berisi 1 kolom dan 4 baris pose monyet
    const rowHeight = monkeyImg.height / 4;
    const fullWidth = monkeyImg.width;
    
    // Bersihkan canvas
    monkeyCtx.clearRect(0, 0, monkeyCanvas.width, monkeyCanvas.height);
    
    // Draw the row
    monkeyCtx.drawImage(
        monkeyImg, 
        0, index * rowHeight, fullWidth, rowHeight, // Source (sx, sy, sw, sh)
        0, 0, monkeyCanvas.width, monkeyCanvas.height     // Destination (dx, dy, dw, dh)
    );
}

async function startPhotobooth() {
    startBtn.disabled = true;
    userPhotos = [];
    currentPhotoIndex = 0;
    
    // Resume audio context inside user interaction to fix browser policies
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    takeNextPhoto();
}

function takeNextPhoto() {
    if (currentPhotoIndex >= totalPhotos) {
        finishPhotobooth();
        return;
    }

    drawMonkeyPose(currentPhotoIndex);
    statusText.innerText = `Foto ke-${currentPhotoIndex + 1} dari ${totalPhotos}. Tiru posenya!`;
    
    let countdown = 5;
    timerOverlay.innerText = countdown;
    timerOverlay.classList.remove('hidden');

    const timerInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            timerOverlay.innerText = countdown;
            playBeep(440, 0.1); // Short low beep
        } else {
            clearInterval(timerInterval);
            timerOverlay.classList.add('hidden');
            playBeep(880, 0.3); // High beep on capture
            capturePhoto();
            
            // Wait 1.5 second before next photo
            setTimeout(() => {
                currentPhotoIndex++;
                takeNextPhoto();
            }, 1500);
        }
    }, 1000);
}

function capturePhoto() {
    // Flash effect
    flashOverlay.classList.remove('hidden', 'flash-active');
    void flashOverlay.offsetWidth; // trigger reflow
    flashOverlay.classList.add('flash-active');
    
    // Set internal canvas to video dimension
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    
    // Flip horizontally because video is mirrored via CSS
    captureCtx.translate(captureCanvas.width, 0);
    captureCtx.scale(-1, 1);
    
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Save image data URL
    userPhotos.push(captureCanvas.toDataURL('image/png'));
}

function finishPhotobooth() {
    statusText.innerText = "Selesai! Sedang memproses hasil...";
    boothContainer.classList.add('hidden');
    controls.classList.add('hidden');
    
    generateFinalImage();
}

function generateFinalImage() {
    // Ukuran satu frame foto di final canvas
    const frameWidth = 400;
    const frameHeight = 300;
    
    // Total final canvas width = Kiri(User) + Kanan(Monkey), Height = 4 rows
    finalCanvas.width = frameWidth * 2;
    finalCanvas.height = frameHeight * 4;
    
    // Latar belakang hitam
    finalCtx.fillStyle = "#000";
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    const rowHeight = monkeyImg.height / 4;
    const fullWidth = monkeyImg.width;

    let loadedCount = 0;

    userPhotos.forEach((dataUrl, index) => {
        let img = new Image();
        img.onload = () => {
            // Draw User Photo (Left Column)
            // Gambar harus di-crop/cover agar proporsional
            drawImageCover(finalCtx, img, 0, index * frameHeight, frameWidth, frameHeight);
            
            // Draw Monkey Photo (Right Column) from original sprite
            finalCtx.drawImage(
                monkeyImg,
                0, index * rowHeight, fullWidth, rowHeight, // Source
                frameWidth, index * frameHeight, frameWidth, frameHeight // Dest
            );
            
            loadedCount++;
            if (loadedCount === totalPhotos) {
                // Semua foto tergambar
                resultSection.classList.remove('hidden');
            }
        };
        img.src = dataUrl;
    });
}

function drawImageCover(ctx, img, x, y, w, h) {
    let imgRatio = img.width / img.height;
    let targetRatio = w / h;
    let sWidth, sHeight, sx, sy;

    if (imgRatio > targetRatio) {
        // Gambar lebih lebar
        sHeight = img.height;
        sWidth = sHeight * targetRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        // Gambar lebih tinggi
        sWidth = img.width;
        sHeight = sWidth / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

function downloadPhoto() {
    const link = document.createElement('a');
    link.download = 'monkey-photobooth-result.png';
    link.href = finalCanvas.toDataURL('image/png');
    link.click();
}

function resetPhotobooth() {
    resultSection.classList.add('hidden');
    boothContainer.classList.remove('hidden');
    controls.classList.remove('hidden');
    
    startBtn.disabled = false;
    statusText.innerText = "Siap untuk berfoto?";
    drawMonkeyPose(0);
}
